exports.handler = function(event, context) {

    var async = require("async");
    var config = require('./config.js');
    var tasks = require('./tasks.js');
    tasks.init(config);

    var result_failed = [];
    var result_updated = [];
    var result_passed = [];

    async.each(config.envs,function(item,callback_outer){
        async.waterfall([

            // 1. get env's info & validate
            function(callback){
                async.parallel([
                    // 1-1. get env's status & check is healthy
                    function(callback_inner) {
                        tasks.getTask_EbInfo(item.nameApp,item.nameEnv,callback_inner);
                    },
                    // 1-2. get env's EC2 type & check is t2
                    function(callback_inner) {
                        tasks.getTask_EbEC2Type(item.nameApp,item.nameEnv,callback_inner);
                    },
                    // 1-3. get env's EC2 list & get healty list
                    function(callback_inner) {
                        tasks.getTask_EbEC2List(item.nameEnv,callback_inner);
                    }],
                // callback_inner for parallel
                function(err,results){
                    if ( err ) {
                        callback(err);
                    }
                    else {
                        callback(null,results[2]);
                    }
                });
            },

            // 2. calculate average cpu credit
            function(EC2List, callback){
                console.log(EC2List);
                tasks.getTask_EC2Credit(item.nameEnv,EC2List,callback);
            },

            // 3. put data to cloudwatch, current scale
            function(cpuCredit_avg,scaleFrom,callback) {
                if( item.putCloudwatch ) {
                    tasks.setTask_putCpuCredit(item.nameEnv,cpuCredit_avg,scaleFrom,callback);
                }
                else {
                    callback(null,cpuCredit_avg,scaleFrom);
                }
            },

            // 4. check scaling needed
            function(cpuCredit_avg,scaleFrom,callback) {
                var scaleTo = scaleFrom;
                if (cpuCredit_avg > item.creditThreshold_upper) {
                    //scale in
                    scaleTo = Math.max(item.scale_min,(scaleTo-item.scale_dec));
                }
                else if (cpuCredit_avg < item.creditThreshold_lower) {
                    //scale out
                    scaleTo = Math.min(item.scale_max,(scaleTo+item.scale_inc));
                }
                if ( scaleTo === scaleFrom ) {
                    callback({
                        envName : item.nameEnv,
                        api : 'calculate scaling',
                        result : 'passed',
                        detail : 'no need to scale (cpuCreditAvg:'+cpuCredit_avg+')'
                    });
                }
                else {
                    callback(null,scaleFrom,scaleTo);
                }
            },

            // 5. environment scaling
            function(scaleFrom, scaleTo, callback) {
                tasks.setTask_EbScale(item.nameApp,item.nameEnv,scaleFrom,scaleTo,callback);
            }

        ]
        ,
        // callback for waterfall
        function(result) {
            resultString_ok = result.envName+' - '+result.result+':'+result.detail;
            resultString_fail = result.envName+' - '+result.api+' '+result.result+':'+result.detail;
            resultString_unhandled = result.envName+' - unhandled error'+':'+result.detail;

            if (result.result) {
                switch (result.result) {
                case 'updated':
                    result_updated.push(resultString_ok);
                    break;
                case 'passed':
                    result_passed.push(resultString_ok);
                    break;
                case 'failed':
                    result_failed.push(resultString_fail);
                    break;
                default:
                    result_failed.push(resultString_unhandled);
                }
            }
            else {
                result_failed.push(resultString_unhandled);
            }
            callback_outer(null);
        }
        );

    }
    ,
    // callback_outer for each
    function(err) {

        var result_concat = 'lambda result : '+result_failed.concat(result_updated,result_passed);
        console.log(result_concat);

        if (result_failed.length > 0) {
            context.fail(result_concat);
        }
        else {
            context.succeed(result_concat);
        }

    });





};

/*



    function gogo(targetName)
    {
        //tasks.getTask_EbDesc(targetName, goresult);
        //tasks.getTask_EC2Desc(targetName, goresult);
        //tasks.getTask_EC2Credit(targetName, goresult);
    }

    function gogo2(appName,ebName)
    {
        //tasks.getTask_EC2Credit(ebName,appName,goresult);
        //tasks.getTask_EbEC2List(ebName,goresult);
        tasks.getTask_EbInstanceType(appName,ebName,goresult);
        //tasks.getTask_EbDesc(appName,ebName,goresult);
        //tasks.getTask_EbInfo(appName,ebName,goresult);
        //tasks.getTask_EbOptionDesc(appName,ebName,goresult);
        //tasks.setTask_EbScale(appName,ebName,1,goresult);
        //tasks.setTask_putCpuCredit(ebName,140,goresult);
    }

    function goresult(err, result)
    {
        if (err) {
            context.fail(JSON.stringify(err));
        }
        else {
            context.succeed(JSON.stringify(result));
        }
    }

    //gogo('e-48sdxcmtpx');
    //gogo('i-a6ded27f');
    gogo2('My First Elastic Beanstalk Application','myFirstElasticBeans-env');
    //gogo2(['i-a6ded27f'],'myFirstElasticBeans-env');
*/