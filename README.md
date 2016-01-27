# t2.autoscaling - beanstalk
t2 type auto scaling by cpuCredit @ aws elastic beanstalk

##### functional/running test passed. but before use, Test it please
##### give me any report/suggestion, Welcome!

## Why?
 in aws EC2, ['t2'](https://aws.amazon.com/ec2/instance-types/t2/) type is fantastic because of the most cheapest & burst [POWER!!!](https://media.licdn.com/mpr/mpr/p/8/005/071/1ad/3bbdcc4.jpg) <br />
 and, [Elastic Beanstalk](https://aws.amazon.com/elasticbeanstalk/) is great for manage(deploy,scaling,..) application. <br />
 I was trying to combine both, but one challenge - **for auto scaling, what metric should I use?** <br />
 't2' use cpu power by 'credit', and limited by that. so we can't use auto scaling by cpu usage. <br />
 aws people's suggestion was 'latency'.. but cure can't better than prevention. <br />
 So I made this - **auto scaling by amount of cpu credit available**

## Feature
* auto scale your Elastic Beanstalk Environment by cpu credit (average of each EC2's cpu credit)
* control multiple environment's scaling option
* run by lambda function (with scheduled event)
* (optional) put cloudwatch custom metric - current cpu credit(average), current EC2 scale

## File Structure
* **index.js** - main handler & flow source. using [async](https://github.com/caolan/async)
* **tasks.js** - Detail work sources. using AWS SDK
* **config.js** - capacity scaling rule configuration

## How to use
1. `$ git clone https://github.com/rockeee/t2.autoscaling-beanstalk.git` or download zip
2. `$ npm install` to download npm modules
3. modify `config.js` for your configuration.
  * 1 credit provides the performance of a full cpu power for one minute
  * Initial credit is 30(~small) or 60(medium~). for stable scaling, set `creditThreshold_lower` to lower than that.
   ```js
  module.exports = {
    region : 'us-west-2',
    envs :
        [
            {
             nameApp : 'My First Elastic Beanstalk Application', // application name
             nameEnv : 'myFirstElasticBeans-env',                // environment name
             creditThreshold_upper : 40,     // credit is more than this, do scale in
             creditThreshold_lower : 20,     // credit is less than this, do scale out
             scale_inc : 2,                  // scale out amount
             scale_dec : 1,                  // scale in amount
             scale_max : 5,                  // maximum scale
             scale_min : 1,                  // minimum scale
             putCloudwatch : true            // if you want to see credit/scale info, set true
            }
            // additional enviroemnt...
        ]
  };
```
4. deploy to lamda function with your favorite method (just zip, or use tool like [node-lambda](https://www.npmjs.com/package/node-lambda))
5. check lambda function's configuration
  * set `Cloudwatch Event Rule` to run your lambda function. for detail, refer [this](https://aws.amazon.com/blogs/aws/new-cloudwatch-events-track-and-respond-to-changes-to-your-aws-resources/)
  * set & attach `role` to lambda function
  * example role policy
   ```json
    {
      "Version": "2012-10-17",
      "Statement": [
          {
              "Sid": "Stmt1453906343000",
              "Effect": "Allow",
              "Action": [
                  "elasticbeanstalk:DescribeConfigurationSettings",
                  "elasticbeanstalk:DescribeEnvironments",
                  "elasticbeanstalk:DescribeInstancesHealth",
                  "elasticbeanstalk:UpdateEnvironment"
              ],
              "Resource": [
                  "*"
              ]
          },
          {
              "Sid": "Stmt1453906416000",
              "Effect": "Allow",
              "Action": [
                  "cloudwatch:GetMetricStatistics",
                  "cloudwatch:PutMetricData"
              ],
              "Resource": [
                  "*"
              ]
          },
          {
              "Sid": "Stmt1453907067000",
              "Effect": "Allow",
              "Action": [
                  "logs:CreateLogGroup",
                  "logs:CreateLogStream",
                  "logs:PutLogEvents"
              ],
              "Resource": [
                  "*"
              ]
          }
      ]
}
```
6. if you config to put cloudwatch data,<br />you can see `Beanstalk_t2_autoscaling` custom metrics @cloudwatch console.

## Roadmap
* add SNS noti when scaled/failed
