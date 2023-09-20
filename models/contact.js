const mongoose = require('mongoose');
const Joi = require('joi');
const Schema = mongoose.Schema;
const chalk = require('chalk');

const contactSchema = new Schema({
    name: {
        type: String,
        minlength: 5,
        required: true
    },
    email: {
        type: String,
        minlength: 5,
        maxlength: 255,
        require: true,
    },
    message: {
        type: String,
        minlength: 10,
        maxLength: 1024,
        required: true,

    },
    imageUrl: {
        type: String,
        required: true,
    },
    isResponded: {
        type: Boolean,
        default: false,
    },
    resolvedBy: {
        type: Schema.Types.ObjectID,
        ref: 'User',
    },

}, {
    timestamps: true
});

const Contact = mongoose.model('Contact', contactSchema, 'contacts');

validateContactSchema = async (contactData) => {
    const schema = Joi.object({
        email: Joi.string().email({minDomainSegments: 2, tlds: {allow: ['com', 'org', 'in']}}).required(),
        name: Joi.string().min(3).max(40).required(),
        message: Joi.string().min(3).max(1024).required(),
        imageId: Joi.string().min(24).max(24).required()

    });
    try {
        return await schema.validate(contactData);
    } catch (err) {
    }
};

exports.Contact = Contact;
exports.validateContactSchema = validateContactSchema;
