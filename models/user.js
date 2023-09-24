const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const chalk = require('chalk');
const {boolean} = require("joi");
// const {error, warn, info} = require('../middleware/error');

const Schema = mongoose.Schema;

const userSchema = new Schema({
    name: {
        type: String,
        required: true,
        minlength: 3,
        maxlength: 100,
    },
    email: {
        type: String,
        minlength: 5,
        maxlength: 255,
        unique: true,
        require: true,
    },
    password: {
        type: String,
        required: true,
        minlength: 5,
        maxlength: 1024
    },
    role: {
        type: String,
        minlength: 4,
        maxlength: 10,
        default: 'user'
    },
    isActive: {type: Boolean, default: true},

    avatarImageUrl: {
        type: String,
        default: 'https://storage.googleapis.com/dews_avatars/avatars/men.png'
    },

}, {
    timestamps: true,
});


userSchema.methods.generateAuthToken = async (user) => {
    return jwt.sign({
        _id: user._id,
        role: user.role,
        name: user.name,
        isActive: user.isActive
    }, 'secretKey', {expiresIn: '24h'});
};

const User = mongoose.model('User', userSchema, 'users');

validateUserRegistrationByPassword = async (userData) => {
    console.log(userData);
    const pattern = '^(?=.*\\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[a-zA-Z]).{8,}$';
    const schema = Joi.object({
        email: Joi.string().email({minDomainSegments: 2, tlds: {allow: ['com', 'in', 'org',]}}).required(),
        name: Joi.string().min(3).max(40).required(),
        password: Joi.string().min(6).max(100).pattern(new RegExp(pattern)).required().message("Password is too weak"),
        returnSecureToken: Joi.boolean().invalid(false).required(),
    });
    try {
        return await schema.validate(userData);
    } catch (err) {
    }
};


validateUpdateUserAdminUpdateSchema = async (tempUpdateData) => {
    const schema = Joi.object({
        id: Joi.string().min(24).max(24).required(),
        isAdmin: Joi.boolean().required(),
    });
    try {
        return await schema.validate(tempUpdateData);
    } catch (err) {
    }
};

validateUpdateUserActiveUpdateSchema = async (tempUpdateData) => {
    const schema = Joi.object({
        id: Joi.string().min(24).max(24).required(),
        isActive: Joi.boolean().required(),
    });
    try {
        return await schema.validate(tempUpdateData);
    } catch (err) {
    }
};

validatePasswordLogin = async (userData) => {
    const pattern = '^(?=.*\\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[a-zA-Z]).{8,}$';
    const schema = Joi.object({
        email: Joi.string().email({minDomainSegments: 2, tlds: {allow: ['com']}}).required(),
        password: Joi.string().min(6).max(40).pattern(new RegExp(pattern)).message("Password is weak!").required(),
        returnSecureToken: Joi.boolean().invalid(false).required(),
    });
    try {
        return await schema.validate(userData);
    } catch (err) {
    }
};

exports.User = User;
exports.validateByPassword = validateUserRegistrationByPassword;
exports.validatePasswordLogin = validatePasswordLogin;
exports.validateUpdateUserAdminUpdateSchema = validateUpdateUserAdminUpdateSchema;
exports.validateUpdateUserActiveUpdateSchema = validateUpdateUserActiveUpdateSchema;
