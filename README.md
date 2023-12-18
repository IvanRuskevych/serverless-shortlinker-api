# Serverless ShortLinker API

ShortLinker Backend enables registered users to create and manage shortened links. Users can deactivate links, view statistics for each link, and set expiration durations, including one-time use. The application, based on AWS serverless technologies, ensures efficient link management with minimal setup.

### Prerequisites to use ShortLinker API:

- Install the latest Node.js ([documentation](https://nodejs.org/en))
- Install serverless framework globally: `npm install -g serverless`
- Install AWS Command Line Interface (CLI) ([documentation](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html))
- Create AWS Account ([documentation](https://repost.aws/knowledge-center/create-and-activate-aws-account))
- Create an administrative user ([documentation](https://docs.aws.amazon.com/IAM/latest/UserGuide/getting-set-up.html#create-an-admin))
- Configure AWS CLI ([documentation](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-configure.html#cli-configure-quickstart-config))

### Running:

- Open terminal in the project main folder
- Install dependencies: `npm install`
- Deploy project to AWS: `sls deploy`
- For remove all services from AWS: `sls remove`

### Endpoints:

#### `- Auth:`

- `(POST) /auth/sign-up` - users register
- `(POST) /auth/sign-in` - users login

#### `- Links:`

- `(POST) /links/create-new-link` - create link by the user
- `(GET) /links/list` - list all links created by the user
- `(GET) /links/{linkMarker}` - redirect to original link
- `(PATCH) /links/deactivate/{linkID}` - deactivate a link (by user request) by id
- `(GET) /links/deactivate` - deactivate links (by cron) that are expired

### Environment Variables

`secrets.json`:

```json
{
  "SECRET_ACCESS_TOKEN": "",
  "SECRET_REFRESH_TOKEN": "",
  "SES_EMAIL": ""
}
```
