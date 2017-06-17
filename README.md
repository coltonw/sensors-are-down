Sensors are down!
=================

This is an Alexa game involving space combat using some simple card game mechanics.

It is build using the [Serverless Framework](https://serverless.com/) to deploy and Amazon Alexa for the platform.

Setting up
----------

`npm install -g serverless`

[Set up serverless with your AWS credentials](https://serverless.com/framework/docs/providers/aws/guide/credentials/)

```
npm i
serverless deploy -v
```

[Go through the first few steps of setting up an Alexa skill](https://developer.amazon.com/edw/home.html)

Use the [`speechAssets/intents.json`](speechAssets/intents.json) for the Intent Schema section and use [`speechAssets/utterances.txt`](speechAssets/utterances.txt) for the Sample Utterances.

For Service endpoint, you want to select AWS Lambda ARN and pick your geography. Then fill the text box with the ARN that `serverless deploy -v` printed earlier. If you missed it, you can always run `serverless info -v` to get it again.

On the test page, you can mess around a bit but it does not allow a dialog, so you need to follow steps to [register your Alexa device](https://developer.amazon.com/public/solutions/alexa/alexa-skills-kit/docs/testing-an-alexa-skill#h2_register) with the developer console.

**YO MIKE: Please insert any missing steps for how to get this working on your actual device**

Do not proceed beyond the test page. That is for actually publishing your skill.  You have already gone far enough to test it on your device.
