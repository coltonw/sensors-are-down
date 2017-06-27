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

* Run `node speechAssets/generateCardCustomSlotType.js` from your base directory to generate a file needed in the next step.

* On the Interaction Model page, use the contents of [`speechAssets/intents.json`](speechAssets/intents.json) for the Intent Schema section.  Then add a custom slot type called `CARD` and use the contents of your newly generated `speechAssets/CardCustomSlotType.txt` for the values. Lastly, use [`speechAssets/utterances.txt`](speechAssets/utterances.txt) for the Sample Utterances. Click Next.

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

### Player perspective
```
Choose attack -> Hear opponent's attack -> Choose defense
^                                           │
│                                           v
└── If game continues <- Hear result of all combat -> If victory or defeat,
                                                      hear end of game info
```

### Engine perspective
1. Give player two attack choices. Choices are from the player's deck and have offense === true
2. Player chooses attack action
3. Choose opponent's attack (randomly for now)
4. Speak opponent's attack to player and give player two defense choices.  Choices are from the player's deck and have `defense === true` and ship or planet === opponent's attack ship or planet and opponent cards in play on the ship or planet. If opponent cards in play and offensive choice cover both planet and ship, defense choices are always one planet defense option one ship defense option.
5. Player chooses defense action
6. Calculate if victory has occurred, if victory or defeat, skip to 10
7. Calculate combat results. See next section.
8. Give player important combat results
9. ^ Back to 1 ^
10. Give player end of game info

### Combat mechanics
* Attacks go to the planet or to the opponent's ship.
* Defense goes to the planet or to your own ship.
* Check each ship and the planets, three "combat zones", to see if victory has occurred
   * If this is a ship and the defense has 0 cards at the ship, the ship takes one damage. 2 damage and the ship is destroyed and the offensive team wins with a ship victory.
   * If this is the planet and one side has 0 cards, the other side is now "entrenched". If they were already entrenched, they win with a planet victory.
   * If a ship victory and a planet victory happen at once, the ship victory takes precedence.  If two ship victories happen at once, whoever has the higher strength on the planet wins. If they have equal strength on the planet, the game ends in a draw.
* Combat occurs independently on each ship and the planet
   * Add strength of all cards on each side. If one side has more they get one bonus defense this combat.
   * Add all strength and defense of one side and subtract all offense and strength of the other side for the new total strength of the defending side (you may not gain strength this way). Strength is removed from cards in a fifo order. 0 strength cards are deleted from the combat zone and will no longer apply their offense or defense or other ongoing effects.
   * Repeat for the other side.
* If on the planet an entrenched side has 0 cards left after combat, they lose the status of entrenched.
