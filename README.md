Sensors are down!
=================

This is an Alexa game involving space combat using some simple card game mechanics.

It is build using the [Serverless Framework](https://serverless.com/) to deploy and Amazon Alexa for the platform.

Setting up
----------

`npm install -g serverless`

[Set up serverless with your AWS credentials](https://serverless.com/framework/docs/providers/aws/guide/credentials/)

From the sensors-are-down root directory, run:

```
npm i
serverless deploy -v
```

This will create a role in your AWS Identity and Access Management (IAM) console and deploy a function for the skill on AWS Lambda. You will need to add some permissions to the IAM role:

* [Go to the IAM console](https://console.aws.amazon.com/iam/home)
* Click the Roles tab and then click your `sensors-are-down-alexa-skill-dev-...-lambdaRole` role.
* Under Permissions -> Managed Policies, click the Attach Policy button.
* Search for and select "AmazonDynamoDBFullAccess" and click Attach Policy.


Go through the first few steps of setting up an Alexa skill:

* [Go to the Alexa tab on the Amazon Developer Console](https://developer.amazon.com/edw/home.html)

* Under "Alexa Skills Kit", click "Get Started" and then "Add a New Skill"

* On the Skill Information page, under "Global Fields" be sure to leave "Audio Player" set to No, and click Next.

* On the Interaction Model page, use the contents of [`speechAssets/intents.json`](speechAssets/intents.json) for the Intent Schema section and use [`speechAssets/utterances.txt`](speechAssets/utterances.txt) for the Sample Utterances. Click Next.

* On the Configuration page, for Service Endpoint Type, you want to select AWS Lambda ARN and pick your geography. Then fill the text box with the ARN that `serverless deploy -v` printed earlier. If you missed it, you can always run `serverless info -v` to get it again (It's the `SensorsAreDownLambdaFunctionQualifiedArn`). Note that you will need to exclude the version at the very end (`:1`), the ARN should end with `sensorsAreDown`.

* Leave the default settings for Account Linking and Permissions and click Next.

* On the Test page, you can mess around a bit but it does not allow a dialog, so you need to follow steps to [register your Alexa device](https://developer.amazon.com/public/solutions/alexa/alexa-skills-kit/docs/testing-an-alexa-skill#h2_register) with the developer console.

**YO MIKE: Please insert any missing steps for how to get this working on your actual device**  (yeah i'm on it next)

Do not proceed beyond the test page. That is for actually publishing your skill.  You have already gone far enough to test it on your device.
