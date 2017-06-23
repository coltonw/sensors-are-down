Sensors are down!
=================

This is an Alexa game involving space combat using some simple card game mechanics.

It is build using the [Serverless Framework](https://serverless.com/) to deploy and Amazon Alexa for the platform.

Setting up
----------

Go through the first few steps of setting up an Alexa skill:

* [Go to the Alexa tab on the Amazon Developer Console](https://developer.amazon.com/edw/home.html)

* Under "Alexa Skills Kit", click "Get Started" and then "Add a New Skill"

* On the Skill Information page, under "Global Fields" be sure to leave "Audio Player" set to No, and click Save.

* Copy the Application Id that is now listed on this page to a temporary place, you'll need it.

* On the Interaction Model page, use the contents of [`speechAssets/intents.json`](speechAssets/intents.json) for the Intent Schema section and use [`speechAssets/utterances.txt`](speechAssets/utterances.txt) for the Sample Utterances. Click Next.

* On the Configuration page, for Service Endpoint Type, you want to select AWS Lambda ARN and pick your geography. Then fill the text box with the ARN that `serverless deploy -v` printed earlier. If you missed it, you can always run `serverless info -v` to get it again (It's the `SensorsAreDownLambdaFunctionQualifiedArn`). Note that you will need to exclude the version at the very end (`:1`), the ARN should end with `sensorsAreDown`.

* Leave the default settings for Account Linking and Permissions and click Next.

* Do not proceed beyond the test page. That is for actually publishing your skill.  You have already gone far enough to test it on your device.


Create your `config/local.yaml` file:

* Make a copy of `config/local-example.yaml` at `config/local.yaml`.  (local.yaml is in .gitignore).

* Replace the appId in this file with the one you got from the Amazon Developer Console above.  This will override the one in default.yaml when you deploy from your copy of the repo.


Install Serverless and Deploy to AWS!

* `npm install -g serverless`

* [Set up serverless with your AWS credentials](https://serverless.com/framework/docs/providers/aws/guide/credentials/)

* From the sensors-are-down root directory, run:
```
npm i
serverless deploy -v
```
This will create a role in your AWS Identity and Access Management (IAM) console and deploy a function for the skill on AWS Lambda. You will need to add some permissions to the IAM role:

* [Go to the IAM console](https://console.aws.amazon.com/iam/home)
* Click the Roles tab and then click your `sensors-are-down-alexa-skill-dev-...-lambdaRole` role.
* Under Permissions -> Managed Policies, click the Attach Policy button.
* Search for and select "AmazonDynamoDBFullAccess" and click Attach Policy.


Testing
-------

On the Test page of the Amazon Developer Console, you can mess around a bit but it does not allow a dialogue, so you'll need to test on an actual Alexa device (or you can test on another Alexa Voice Service integration, such as the [Ubi App for Android](https://play.google.com/store/apps/details?id=com.avsintegration.android&hl=en)).

If your Amazon Developer account uses the same email address as the Amazon account your Alexa device is registered to, and the "Enabled" toggle on the skill's Test page is turned on, the skill should already be available on your device.  You can find it on the [Your Skills list of the Alexa app](http://alexa.amazon.com/spa/index.html#skills/your-skills/).

If you used a different email address for your Amazon Developer account, follow the steps to [register your Alexa device](https://developer.amazon.com/public/solutions/alexa/alexa-skills-kit/docs/testing-an-alexa-skill#h2_register) with that account.

Game Flow
---------

Player perspective:
```
Choose attack -> Hear opponent's attack -> Choose defense
^                                           |
|                                           v
|-- If game continues <- Hear result of all combat -> If victory or defeat,
                                                      hear end of game info
```

Engine perspective:
```
Give player two attack choices
Player chooses attack action
Choose opponent's attack (randomly for now)
Speak opponent's attack to player and give player two defense choices
Player chooses defense action
Calculate if victory has occurred -> if victory or defeat, give player end of game info
Calculate combat results
Give player important combat results
^ Back to top ^
```
