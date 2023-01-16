const fs = require('fs');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { Client, Collection, GatewayIntentBits, ActivityType, EmbedBuilder } = require('discord.js');
const https = require('https');
const configFile = (process.argv[2]) ? process.argv[2] : './config.json';
const { token, clientId, guildIds, activity } = require(configFile); const config = require(configFile);
const DiscordPlayer = require("./discord-player.js");
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
client.commands = new Collection();

const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const command = require(`./commands/${file}`);
	client.commands.set(command.data.name, command);
}

var DATA = {
	queue: [],
	volume: 1,
	current: null,
	guildId: null,
	status: "Idle",
	queueSong: null
};

var players = new Map();

client.once('ready', () => {
	console.log('Ready!');
	client.user.setActivity(activity, {
		type: ActivityType.Playing
	});
});

client.on('interactionCreate', async interaction => {
	if (!interaction.isCommand()) return;

	const command = client.commands.get(interaction.commandName);
	if (!command) return;

	try {
		await execute(interaction.commandName, interaction);
	} catch (error) {
		console.error(error);
		return interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
	}
});

function deployCommands(guilds) {
	const commands = [];
	const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

	for (const file of commandFiles) {
		const command = require(`./commands/${file}`);
		commands.push(command.data.toJSON());
	}

	const rest = new REST({ version: '9' }).setToken(token);
	(async () => {
		try {
			console.log('Started refreshing application (/) commands.');
			guilds.forEach(await (async (guild, i) => {
				await rest.put(
					Routes.applicationGuildCommands(clientId, guild),
					{ body: commands },
				);
			}));
			console.log('Successfully reloaded application (/) commands.');
		} catch (e) {
			console.log(e);
		}
	})();
}

client.on('guildCreate', (guild) => {
	if (config.guildIds.indexOf(guild.id) == -1) {
		config.guildIds.push(guild.id);
		fs.writeFile(configFile, JSON.stringify(config), (err) => {
			if (err) console.log("[GuildCreate][WriteFile][Error]: ", err);
		});
	}
	deployCommands([guild.id]);
});

client.on('guildDelete', (guild) => {
	const i = config.guildIds.indexOf(guild.id);
	if (i > -1) {
		config.guildIds.splice(i, 1);
	}
	fs.writeFile(configFile, JSON.stringify(config), (err) => {
		if (err) console.log("[GuildDelete][WriteFile][Error]: ", err);
	});
});

async function execute(name, interaction) {
	if (!players.has(interaction.guildId)) {
		const discordPlayer = new DiscordPlayer(client, configFile, DATA);
		discordPlayer.on("log", text => console.log("[" + interaction.guild.name + "][Log] " + text));
		discordPlayer.on("error", error => console.error("[" + interaction.guild.name + "][Error] " + error));
		discordPlayer.on("state", state => console.log("[" + interaction.guild.name + "][State Update] " + state));
		players.set(interaction.guildId, discordPlayer);
	}
	try {
		const discordPlayer = players.get(interaction.guild.id);
		switch (name) {
			case "join":
				await interaction.deferReply();
				let s = discordPlayer.join(interaction);
				if (!s) { interaction.editReply({ content: "Please join a voice channel first", ephemeral: true }); return; }
				interaction.editReply({ content: "Joined." });
				break;
			case "leave":
				await interaction.deferReply();
				var left = discordPlayer.leave(interaction);
				if (left) {
					return interaction.editReply({ content: "Left the voice channel" });
				}
				return interaction.editReply({ content: "I'm not connected to a voice channel...", ephemeral: true });
			case "create":
				const message = await interaction.deferReply({
					fetchReply: true
				});
				const user = message.author
				const file = interaction.options.getAttachment('attach');
				phrases = interaction.options.get("phrases").value.split(";");
				var fields = [];
				for (var i = 0; i < phrases.length; i++) {
					fields.push({
						name : "Phrase" + (i+1),
						value: phrases[i]
					})
				 }
				const emb = new EmbedBuilder()
					.setAuthor({ name: user.username, iconURL: user.displayAvatarURL(true)})
					.setTitle('Audio Uploaded Successfully')
					.setDescription(file.name)
					.addFields(fields)
					.setTimestamp()
					.setFooter({ text: 'Successfully', iconURL: user.displayAvatarURL(true) })
				downloadImage(file.url, file.name)
				return interaction.editReply({ embeds: [emb] })
			default:
				break;
		}
	} catch (e) {
		console.error("Error: ", e);
	}
}

function downloadImage(url, name){
	https.get(url,(res) => {
		// Image will be stored at this path
		const path = `./sounds/${name}`; 
		const filePath = fs.createWriteStream(path);
		res.pipe(filePath);
		filePath.on('finish',() => {
			filePath.close();
			console.log('Download Completed'); 
		})
	})
}

const tmp = config.guildIds.slice();
	const guilds = client.guilds.cache.map(guild => guild.id);;
	guilds.forEach((guild, i) => {
		if (!config.guildIds.includes(guild)) {
			config.guildIds.push(guild);
		}
	});
	if (tmp.some(r => config.guildIds.indexOf(r) >= 0)) {
		fs.writeFile(configFile, JSON.stringify(config), (err) => {
			if (err) console.log("[GuildDelete][WriteFile][Error]: ", err);
		});
	}

	deployCommands(guildIds);

	client.login(token);