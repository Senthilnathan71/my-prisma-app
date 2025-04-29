module.exports = {
    apps: [
        {
            name : 'crm-mobile',
            script : './dist/src/main.js',
            instances : 1,
            exec_mode : 'cluster',
            autorestart : true,
            watch : false,
            output : '/dev/null',
            error : './error.log',
            exp_backoff_restart_delay : 100,
            env : {
                name : 'crm-mobile-prod',
                NODE_ENV : 'production',
                PORT: 3008
            }
        }
    ]
}