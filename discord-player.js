const { AudioPlayerStatus, joinVoiceChannel, getVoiceConnection, createAudioPlayer, createAudioResource, NoSubscriberBehavior, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const events = require('events');
var stringSimilarity = require("string-similarity");
const Transcriber = require("discord-speech-to-text");
let { audios } = require('./audios.json')

class VoiceParser {
  constructor() {
    return this;
  }

  parse(string) {
    let output = string.repeat(1);
    string = string.replace("/\./g", "");
    string = string.toLowerCase().trim();
    if (string.includes(" ")) string = string.split(" ")[0];
    string = string.trim();
    output = output.replace(/\./g, "").toLowerCase().trim();
    return output;
  }
}

class DiscordPlayer {
  constructor(client, configFile, data) {
    this.events = new events.EventEmitter();

    this.client = client;
    this.data = data;
    this.config = require(configFile);

    this.stateMsg;

    this.DISCORD_CHAR_LIMIT = 1950;

    this.transcriber = new Transcriber(this.config.witAi);
    this.voiceParser = new VoiceParser();

    this.textChannel = null;

    this.player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Pause
      }
    });
    this.player.on(AudioPlayerStatus.Idle, () => {
      this.data.status = "Idle";
      this.current = null;
      this.playNext();
    });
    this.player.on(AudioPlayerStatus.Playing, () => {
      this.data.status = "Playing";
    });
    this.player.on(AudioPlayerStatus.Buffering, () => {
      this.data.status = "Buffering";
    });
    this.player.on(AudioPlayerStatus.AutoPaused, () => {
      this.data.status = "AutoPaused";
    });
    this.player.on(AudioPlayerStatus.Paused, () => {
      this.data.status = "Paused";
    })

    return this;
  }
  log(data) {
    this.events.emit("log", data);
  }
  error(data) {
    this.events.emit("error", data);
  }

  on(event, handler) {
    this.events.on(event, handler);
  }
  once(event, handler) {
    this.events.once(event, handler);
  }

  addToQueue(data) {
    this.data.queue.push(data);
  }

  playNext() {
    if (this.data.queue.length == 0) {this.data.current = null; return false;}
    const current = this.data.current;
    const data = (this.data.queueSong) ? current : this.data.queue.shift();
    this.data.volume = 1;
    this.data.current = data;
    const resource = createAudioResource(data);
    this.connection = getVoiceConnection(this.data.guildId);
    this.connection.subscribe(this.player);
    this.player.play(resource);
  }

  leave() {
    const connection = getVoiceConnection(this.data.guildId);
    if (connection) {
      this.player.stop();
      connection.destroy();
      this.data.current = null;
      this.data.queue = [];
      return true;
    }
    return false;
  }

  updateAudios(){
    delete require.cache[require.resolve('./audios.json')]
    audios = require("./audios.json").audios
  }

  getAudioSelection(cmd){
    let result = 0;
    let file;
    audios.forEach((audio) => {
      audio.phrases.forEach((phrase) => {
        var current = stringSimilarity.compareTwoStrings(phrase, cmd)
        if (current > result) {
          result = current;
          file = audio.name;
        }
      })
    })
    return {result, file};
  }

  async execVoiceCom(cmd) {
    switch (cmd.split(" ")[0]) {
      case "apoptose":
        var left = this.leave();
        if (left) return this.textChannel.send({ content: "Left the voice channel" });
        this.textChannel.send({ content: "I'm not connected to a voice channel..." });
        break;
      default:
        this.updateAudios();
        var {result, file} = this.getAudioSelection(cmd)    
        if (result > 0.7) {
          this.log("Voice found")
        }
        if (result > 0.7) {
          if(!this.data.queue.includes(`./sounds/${file}.mp3`)){
            this.addToQueue(`./sounds/${file}.mp3`)
          }  
          if (this.data.current == null){
            this.playNext();
          } 
        }
        break;
    }
  }

  join(interaction) {
    if (!interaction.member.voice.channel) {
      return false;
    }
    this.log("Establishing connection");
    this.data.guildId = interaction.member.guild.id;
    this.textChannel = interaction.channel;
    let channel = interaction.member.guild.channels.cache.get(interaction.member.voice.channel.id);
    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false
    });
    connection.receiver.speaking.on("start", (userId) => {
      const user = this.client.users.cache.get(userId);
      this.log("Listening to " + user.username);
      this.transcriber.listen(connection.receiver, userId, user).then((data) => {
        if (!data.transcript.text) return;
        let parsed = this.voiceParser.parse(data.transcript.text);
        if (!parsed) { return; }
        this.log(parsed);
        this.execVoiceCom(parsed);
      });
    });
    connection.on(VoiceConnectionStatus.Disconnected, async (oldState, newState) => {
      try {
        this.log("Reconnecting to voice channel...");
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
        // Seems to be reconnecting to a new channel - ignore disconnect
      } catch (error) {
        this.error("Disconnected from voice channel!");
        this.data.current = null;
        connection.destroy();
      }
    });

    return true;
  }
}

module.exports = DiscordPlayer;