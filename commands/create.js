const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
  data: new SlashCommandBuilder()
    .setName("create")
    .setDescription("Create new audio setting.")
    .addAttachmentOption(option => option
      .setName('attach')
      .setDescription('Attachment File')
      .setRequired(true))
    .addStringOption(
      option => option.setName('phrases')
      .setDescription("Insert the phrases separated by ;")
      .setRequired(true)
    )
};