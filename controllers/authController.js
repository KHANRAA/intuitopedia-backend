const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const chalk = require('chalk');
const _ = require('lodash');
const rateLimit = require("express-rate-limit");


const {
    User,
    validateByPassword,
    validatePasswordLogin
} = require('../models/user');
const winston = require("winston");


const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minutes
    max: 15,
    validate: {xForwardedForHeader: false},
    message: {message: 'Nice try , please try again after sometime .....', title: 'Too Many requests'}
});

router.get('/', (req, res, next) => {
    res.status(200).send('Hi, From User Module');
});

router.post('/signup', apiLimiter, async (req, res, next) => {
        if (!req.body) {
            return next(new Error);
        }
        const passedData = req.body.data;
        const joiValidate = await validateByPassword(passedData);
        if (joiValidate.error) return sendErrorResponse(res, joiValidate.error.details[0].message);
        passedData.email = passedData.email.toLowerCase();
        const salt = await bcrypt.genSalt(10);
        console.log(chalk.red(`Received signup request with : ${passedData}`));
        let user = await User.findOne({email: passedData.email.toLowerCase()});
        if (user && (!user.isActive)) {

            return sendErrorResponse(res, {
                type: 'active',
                email: user.email.toLowerCase(),
                message: 'User is not active  please email us for further help...'
            });
        }
        if (user) return sendErrorResponse(res, {type: 'LOGIN', message: 'User is already exists please login....'});
        const password = await bcrypt.hash(passedData.password, salt);
        user = new User({
            name: passedData.name,
            email: passedData.email.toLowerCase(),
            isSpam: false,
            role: 'user',
            password,
        });
        await user.save()
            .then(async result => {
                console.log(JSON.stringify(result));
                return sendSuccessResponse(res, _.pick(result, ['_id', 'name', 'role', 'avatarImageUrl']));
            })
            .catch(err => {
                next(err);
            });
    }
);


router.post('/login', apiLimiter, async (req, res, next) => {
    if (!req.body) {
        return next(new Error);
    }
    const passedData = req.body.data;
    const joiValidate = await validatePasswordLogin(passedData);
    if (joiValidate.error) return sendErrorResponse(res, {
        type: 'signup',
        message: joiValidate.error.details[0].message
    });
    let user = await User.findOne({email: passedData.email.toLowerCase()});
    if (!user) return sendErrorResponse(res, {type: 'SIGNUP', message: 'User is not registered please register...'});
    if (user && user.isSpam) return sendErrorResponse(res, {
        type: 'spam',
        message: 'User is banned for suspicious activity please contact us via email/phone ...'
    });

    const validPassword = await bcrypt.compare(passedData.password, user.password);
    if (!validPassword) return sendErrorResponse(res, {type: 'wrongPassword', message: 'Wrong Password ...'});
    if (user && (!user.isActive)) {

        return sendErrorResponse(res, {
            type: 'active',
            message: `User ${passedData.email.toLowerCase()} is not active  please verify email address...`
        });
    }
    const token = await user.generateAuthToken(user);
    const returnData = _.pick(user, ['_id', 'name', 'email', 'role', 'isActive', 'avatarImageUrl']);
    return sendSuccessResponse(res, {
        id: returnData._id,
        email: returnData.email.toLowerCase(),
        name: returnData.name,
        role: returnData.role,
        isAdmin: returnData.role === 'admin',
        isActive: returnData.isActive,
        tuitoPediaToken: token,
        expiresIn: '8640000'
    });

});


const sendSuccessResponse = (res, responseMessage) => {
    res.json({status: 200, data: responseMessage});
};

const sendErrorResponse = (res, error) => {
    res.status(400).json({status: 400, data: error});
};

module.exports = router;
