import nodemailer from "nodemailer";
import dotenv from "dotenv";
import {
  AD_MAIL_TEMPLATE,
  CONTACT_MAIL_TEMPLATE,
  NEWS_ADDED_TEMPLATE,
} from "./mailTemplates.js";

dotenv.config();

const { EMAIL_USER, EMAIL_PASS } = process.env;

let transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS, 
  },
});

export const sendNewsAddedEmail = async (data) => {
  const { email, fullName, postedBy, category, imgSrc, newsTitle, postLink } =
    data;

  //mail options
  const mailOptions = {
    from: EMAIL_USER,
    to: email,
    subject: "News Added",
    html: NEWS_ADDED_TEMPLATE.replace("{fullName}", fullName)
      .replace("{postedBy}", postedBy)
      .replace("{category}", category)
      .replace("{imgSrc}", imgSrc)
      .replace("{newsTitle}", newsTitle)
      .replace("{postLink}", postLink),
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully to ${email}`);
  } catch (error) {
    console.error(`Failed to send email to ${email}:`, error.message);
    // return { status: "fail", message: "Something went wrong!" };
  }
};

export const sendContactUsEmail = async (data) => {
  const { email, fullName, subject, message, res } = data;

  //mail options
  const mailOptions = {
    from: email,
    to: EMAIL_USER,
    subject: subject,
    html: CONTACT_MAIL_TEMPLATE.replace("{fullName}", fullName)
      .replace("{email}", email)
      .replace("{subject}", subject)
      .replace("{message}", message),
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.log(error);
    return res
      .status(404)
      .send({ status: "fail", message: "Something went wrong!" });
  }
};

export const sendAdEmail = async (data) => {
  const { email, fullName, subject, message, page, adSize, res } = data;

  //mail options
  const mailOptions = {
    from: email,
    to: EMAIL_USER,
    subject: subject,
    html: AD_MAIL_TEMPLATE.replace("{fullName}", fullName)
      .replace("{page}", page)
      .replace("{adSize}", adSize)
      .replace("{email}", email)
      .replace("{subject}", subject)
      .replace("{message}", message),
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.log(error);
    return res
      .status(404)
      .send({ status: "fail", message: "Something went wrong!" });
  }
};
