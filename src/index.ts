import { Probot } from "probot";

export = (app: Probot) => {
  app.on("issue_comment.created", async (context) => {
    type ConfigTemplate = {
      teams: {
        name: string;
        permission:
          | "push"
          | "admin"
          | "pull"
          | "maintain"
          | "triage"
          | undefined;
      }[];
    };

    // some sanity checks
    if (!context.payload.comment.body.startsWith("/create-repo")) {
      return;
    }

    if (!context.payload.organization) {
      const issueComment = context.issue({
        body: "This feature is only available for organizations",
      });
      await context.octokit.issues.createComment(issueComment);
      return;
    }

    const org = context.payload.organization.login;

    // structure of the comment: /create-repo my-new-repo
    const new_repo = context.payload.comment.body.split(" ")[1];

    const config: ConfigTemplate | null = await context.config(
      "repo-maker.yml"
    );

    if (!config) {
      const issueComment = context.issue({
        body:
          "Please setup the config file using the following template: \n\n```yaml\n" +
          JSON.stringify(
            {
              teams: [
                {
                  name: "my-team",
                  permission: "push",
                },
              ],
            },
            null,
            2
          ) +
          "\n```",
      });
      await context.octokit.issues.createComment(issueComment);
      return;
    }

    // create the repo
    context.log.info(`Creating repo ${new_repo} in org ${org}`);
    await context.octokit.repos.createUsingTemplate({
      template_owner: org,
      template_repo: context.payload.repository.name,
      name: new_repo,
      private: true,
      owner: org,
    });

    // person who commented to create the repo should be added to the repo
    context.log.info(
      `Adding user ${context.payload.comment.user.login} to repo ${new_repo} in org ${org}`
    );
    await context.octokit.repos.addCollaborator({
      owner: org,
      repo: new_repo,
      username: context.payload.comment.user.login,
      permission: "admin",
    });

    // add all the teams to the repo from the config
    config.teams.forEach(async (team) => {
      context.log.info(
        `Adding team ${team.name} to repo ${new_repo} with permission ${team.permission} in org ${org}`
      );
      try {
        await context.octokit.teams.addOrUpdateRepoPermissionsInOrg({
          org: org,
          team_slug: team.name,
          owner: org,
          repo: new_repo,
          permission: team.permission,
        });
      } catch (e) {
        context.log.error(e as Error);
      }
    });

    // create a comment on the issue with the new repo details
    context.log.info(`Creating issue comment`);
    const issueComment = context.issue({
      body:
        "Repo " +
        new_repo +
        " has been created. You can access it at: " +
        `https://github.com/${org}/${new_repo}`,
    });
    await context.octokit.issues.createComment(issueComment);
  });
};
