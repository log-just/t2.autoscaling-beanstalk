var env = { };

// initialize
exports.init = function(config) {
    env.AWS = require('aws-sdk');
    env.AWS.config.update({region: config.region});
    env.elasticbeanstalk = new env.AWS.ElasticBeanstalk();
    env.ec2 = new env.AWS.EC2();
    env.cloudwatch = new env.AWS.CloudWatch();
    env.timeframeMin = 10;
    env.startTime = new Date();
    env.endTime = new Date();
    env.startTime.setTime(env.endTime-(60000*env.timeframeMin));
};

// check environment (availability, status, type)
exports.getTask_EbInfo = function(appName, EbName, callback) {
    var params = {
        ApplicationName : appName,
        EnvironmentNames : [EbName]
    };
    env.elasticbeanstalk.describeEnvironments(params, function(err, data) {
        if (err) {
            callback({
                envName : EbName,
                api : 'describeEnvironments',
                result : 'failed',
                detail : err.message
            });
        }
        else {
            if (data.Environments.length > 0 &&
                    data.Environments[0].Status === 'Ready' &&
                    data.Environments[0].Health === 'Green' &&
                    data.Environments[0].EndpointURL.match(/[a-z]/i)) {
                callback(null,true);
            }
            else {
                callback({
                    envName : EbName,
                    api : 'describeEnvironments',
                    result : 'passed',
                    detail : 'No Env found or Env\'s status not ready'
                });
            }
        }
    });
};

// check instance type is t2
exports.getTask_EbEC2Type = function(appName, EbName, callback) {
    var params = {
        ApplicationName : appName,
        EnvironmentName : EbName
    };
    env.elasticbeanstalk.describeConfigurationSettings(params, function(err, data) {
        if (err) {
            callback({
                envName : EbName,
                api : 'describeConfigurationSettings',
                result : 'failed',
                detail : err.message
            });
        }
        else {
            var EC2Type = data.ConfigurationSettings[0].OptionSettings.filter(function(v) {
                return v.OptionName === 'InstanceType';
            } )[0].Value;
            if (EC2Type.indexOf('t2.') !== 0) {
                callback({
                    envName : EbName,
                    api : 'describeConfigurationSettings',
                    result : 'passed',
                    detail : 'env\'s instane type not t2'
                });
            }
            else {
                callback(null,true);
            }
        }
    });
};

// get healthy ec2 list
exports.getTask_EbEC2List = function(EbName, callback) {
    var params = {
        AttributeNames : ['HealthStatus', 'Color'],
        EnvironmentName : EbName
    };
    env.elasticbeanstalk.describeInstancesHealth(params, function(err, data) {
        if (err) {
            callback({
                envName : EbName,
                api : 'describeInstancesHealth',
                result : 'failed',
                detail : err.message
            });
        }
        else {
            var EC2List = data.InstanceHealthList.filter(function(v) {
                return (v.HealthStatus === 'Ok' && v.Color === 'Green');
            }).map(function(v) {
                return v.InstanceId;
            });

            if (EC2List.length === 0) {
                callback({
                    envName : EbName,
                    api : 'describeInstancesHealth',
                    result : 'passed',
                    detail : 'in env, no healthy EC2'
                });
            }
            else {
                callback(null,EC2List);
            }
        }
    });
};

// calculate average cpuCreditBalance
exports.getTask_EC2Credit = function(EbName,EC2List, callback) {
    var async = require("async");
    var sumOfCredit = 0;
    async.each(EC2List,function(EC2Id,callback_inner){
        var params = {
            EndTime: env.endTime,
            MetricName: 'CPUCreditBalance',
            Namespace: 'AWS/EC2',
            Period: (env.timeframeMin*60),
            StartTime: env.startTime,
            Statistics: [ 'Average' ],
            Dimensions: [
            {
                Name: 'InstanceId',
                Value: EC2Id
            }],
            Unit: 'Count'
        };
        env.cloudwatch.getMetricStatistics(params, function(err, data) {
            if (err) {
                callback_inner({
                    envName : EbName,
                    api : 'cloudwatch.getMetricStatistics',
                    result : 'failed',
                    detail : err.message
                });
            }
            else {
                //console.log(data);
                if (data.Datapoints.length < 1) {
                    callback_inner({
                        envName : EbName,
                        api : 'cloudwatch.getMetricStatistics',
                        result : 'passed',
                        detail : 'some EC2 isn\'t yet credit data available'
                    });
                }
                else {
                    sumOfCredit+=data.Datapoints[0].Average;
                    callback_inner(null);
                }
            }
        });
    }
    ,
    function(err){
        if (err) {
            callback(err);
        }
        else{
            callback(null,Number((sumOfCredit/EC2List.length).toFixed(2)),EC2List.length);
        }
    });


};

// scaling beanstalk environment
exports.setTask_EbScale = function(AppName, EbName, scaleFrom, scaleTo, callback) {
    var params = {
        ApplicationName : AppName,
        EnvironmentName : EbName,
        OptionSettings : [
            {
                "Namespace":"aws:autoscaling:asg",
                "OptionName":"MaxSize",
                "Value":scaleTo.toString()
            },
            {
                "Namespace":"aws:autoscaling:asg",
                "OptionName":"MinSize",
                "Value":scaleTo.toString()
            },
            {
                "Namespace":"aws:autoscaling:asg",
                "OptionName":"Cooldown",
                "Value":"0"
            }
            ]
    };
    env.elasticbeanstalk.updateEnvironment(params, function(err, data) {
        if (err) {
            callback({
                envName : EbName,
                api : 'elasticbeanstalk.updateEnvironment',
                result : 'failed',
                detail : err.message
            });
        }
        else {
            callback({
                envName : EbName,
                api : 'scaling done',
                result : 'updated',
                detail : 'scaled : '+scaleFrom+' -> '+scaleTo
            });
        }
    });
};

// put average cpuCredit & current scale to cloudwatch custom metric
exports.setTask_putCpuCredit = function(EbName, cpuCredit_avg, scaleFrom, callback) {
    var params = {
        MetricData : [{
                MetricName : 'CpuCreditAvg',
                Dimensions : [
                {
                  Name: 'EnvName',
                  Value: EbName
                }
                ],
                Timestamp : env.endTime,
                Value : cpuCredit_avg,
                Unit : 'Count'
            },{
                MetricName : 'EC2Scale',
                Dimensions : [
                {
                  Name: 'EnvName',
                  Value: EbName
                }
                ],
                Timestamp : env.endTime,
                Value : scaleFrom,
                Unit : 'Count'
            }],
        Namespace : 'Beanstalk_t2_autoscaling'
    };
    env.cloudwatch.putMetricData(params, function(err, data) {
        callback(null,cpuCredit_avg,scaleFrom);
    });
};