const mongoose = require("mongoose");
const codingQuestionSchema = new mongoose.Schema({
title: {
type: String,
required: true,
},

description: {
type: String,
required: true,
},

difficulty: {
type: String,
enum: ["EASY", "MEDIUM", "HARD"],
default: "MEDIUM",
},

functionName: {
type: String,
required: true,
},

parameters: [
{
name: {
type: String,
required: true,
},
type: {
type: String,
required: true,
},
},
],

returnType: {
type: String,
},

marks:{
type: Number,
required: true,
},

sampleTestCases: [
{
input: String,
expectedOutput: String,
},
],

hiddenTestCases: [
{
input: String,
expectedOutput: String,
},
],

createdBy: {
type: mongoose.Schema.Types.ObjectId,
ref: "User",
required: true,
},
});

module.exports = mongoose.model("CodingQuestion", codingQuestionSchema);




