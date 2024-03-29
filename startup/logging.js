const winston = require('winston');
require('winston-mongodb');
require('express-async-errors');

module.exports = () => {
    winston.add(new winston.transports.File({
        filename: 'winston-error.log',
        level: 'error',
        handleExceptions: true,
    }));
    winston.add(new winston.transports.Console({
        format: winston.format.combine(winston.format.colorize(), winston.format.prettyPrint()),
    }));

    winston.add(new winston.transports.MongoDB({
        db: `${process.env.MONGO_DB_CONNECTION_STRING}`,
        level: 'error'
    }));

};
