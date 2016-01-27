module.exports = {
    region : 'us-west-2',
    envs :
        [
            {
            nameApp : 'My First Elastic Beanstalk Application',
            nameEnv : 'myFirstElasticBeans-env',
            creditThreshold_upper : 40,
            creditThreshold_lower : 20,
            scale_inc : 2,
            scale_dec : 1,
            scale_max : 5,
            scale_min : 1,
            putCloudwatch : true
            }
        ]

};
