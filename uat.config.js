module.exports = {
    apps: [
        {
            name : 'nest-blufin-uat',
            script : './dist/src/main.js',
            instances : 1,
            exec_mode : 'cluster',
            autorestart : true,
            watch : false,
            output : '/dev/null',
            error : './error.log',
            exp_backoff_restart_delay : 100,
            env : {
                name : 'nest-blufin-uat',
                NODE_ENV : 'production',
                PORT: 3009
            }
        }
    ]
}