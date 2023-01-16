[![MIT License](https://img.shields.io/github/stars/hugosteixeira/rpg-voice?style=social)](https://github.com/hugosteixeira/rpg-voice/)



# RPG Discord-Voice

A voice recognition bot for RPG sessions hosted on discord.

The bot recognizes phrases spoken during RPG matches and plays an audio if it is registered as a trigger phrase.

Ex: The dungeon master says: "There's a storm."

If there is an audio registred for this phrase, the audio will play.


## References

 - [DiscordJS](https://discord.js.org/#/)
 - [WitAI](https://wit.ai/)
 - [Discord Developer's Page](https://discord.com/developers/applications)


## Environment variables

Rename the `config-template.json` to `config.json`
Rename the `audios-template.json` to `audios.json`

To run this project, you will need to add the following configs variables to your config.json

`token`: Discord Bot Token

`clientId`: Discord APP Client ID

`witAi`: Your witAi client key


## Authors

- [@hugosteixeira](https://www.github.com/hugosteixeira)

