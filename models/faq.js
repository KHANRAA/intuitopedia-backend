const mongoose = require('mongoose');
const Joi = require('joi');
const Schema = mongoose.Schema;
const ObjectId = mongoose.ObjectId;
const chalk = require('chalk');

const faqSchema = new Schema({
    title: {
        type: String,
        minlength: 5,
        required: true
    },
    createdBy: {
        type: Schema.Types.ObjectID,
        ref: 'User',
    },
    content: {
        type: String,
        required: true,
        minlength: 20,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    imageUrl: {
        type: String,
        required: true,
        minlength: 20,
    },
    category: {
        type: String,
        required: true,
        minlength: 3,
    },
}, {
    timestamps: true
});

const Faq = mongoose.model('Faq', faqSchema, 'faqs');

validateFaqSchema = async (faqData) => {
    const schema = Joi.object({
        title: Joi.string().min(5).max(200).required(),
        content: Joi.string().min(20).required(),
        imageId: Joi.string().min(24).required(),
        category: Joi.string().min(3).required(),
    });
    try {
        return await schema.validate(faqData);
    } catch (err) {
    }
};


validateRequiredFaqSchema = async (faqData) => {
    const schema = Joi.object({
        id: Joi.string().min(24).max(24).required(),
    });
    try {
        return await schema.validate(faqData);
    } catch (err) {
    }
};

exports.Faq = Faq;
exports.validateFaqSchema = validateFaqSchema;
exports.validateRequiredDaSchema = validateRequiredFaqSchema;
