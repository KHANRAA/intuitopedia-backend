const express = require('express');
const router = express.Router();
const chalk = require('chalk');
const _ = require('lodash');
const {User} = require('../models/user')
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const validateObjectId = require('../middleware/validateObjectId');
const {validateUpdateUserAdminUpdateSchema, validateUpdateUserActiveUpdateSchema} = require("../models/user");


router.get('/', (req, res, next) => {
    return res.json({status: 200, data: 'Hi  from AdminController'});
});
router.get('/all', auth, admin, async (req, res, next) => {
    const allUsers = await User.find({})
    const filterUSerData = [];
    allUsers.map(user => {
        filterUSerData.push(_.pick(user, ['_id', 'name', 'email', 'role', 'isActive', 'avatarImageUrl']))
    })

    _.map(filterUSerData, (user) => {
        user.id = user._id;
    });
    return res.json({type: 'SUCCESS', data: [...filterUSerData]});

});


router.delete('/delete', auth, admin, validateObjectId, async (req, res, next) => {
    await User.findOneAndDelete({_id: req.body.data?.id}).then(result => {
        return sendSuccessResponse(res, `${JSON.stringify(result)}`);
    }).catch(err => {
        next(err);
    });

});


router.put('/update/admin', auth, admin, validateObjectId, async (req, res, next) => {

    const receivedData = req.body.data;
    const joiValidate = await validateUpdateUserAdminUpdateSchema(receivedData);
    if (joiValidate.error) return sendErrorResponse(res, joiValidate.error.details[0].message);
    let role;
    receivedData.isAdmin ? role = 'admin' : role = 'user';

    await User.findOneAndUpdate({_id: receivedData.id}, {role: role}).then(result => {
        console.log(chalk.cyan(result));
        result.id = receivedData._id;
        return sendSuccessResponse(res, _.pick(result, ['id', 'name', 'email', 'role', 'isActive', 'avatarImageUrl']));
    }).catch(err => {
        next(err);
    });

});

router.put('/update/active', auth, admin, validateObjectId, async (req, res, next) => {

    const receivedData = req.body.data;
    const joiValidate = await validateUpdateUserActiveUpdateSchema(receivedData);
    if (joiValidate.error) return sendErrorResponse(res, joiValidate.error.details[0].message);
    await User.findOneAndUpdate({_id: receivedData.id}, {isActive: receivedData.isActive}).then(result => {
        console.log(chalk.cyan(result));
        result.id = receivedData._id;
        return sendSuccessResponse(res, _.pick(result, ['id', 'name', 'email', 'role', 'isActive', 'avatarImageUrl']));
    }).catch(err => {
        next(err);
    });

});


const sendSuccessResponse = (res, responseMessage) => {
    res.json({status: 200, data: {...responseMessage}});
};

const sendErrorResponse = (res, error) => {
    res.status(400).json({status: 400, data: {type: 'VALIDATION', message: error}});
};
module.exports = router;
