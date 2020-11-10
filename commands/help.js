module.exports = {
	name: 'help',
	description: 'Simple help command, links user to Wiki and Issues.',
	guildOnly: false,
	cooldown: 0,
	argsMin: 0,
	argsMax: -1,
	usage: '',
	execute(message, args) {
		message.channel.send('You can find a command reference, and other help material here: https://gitlab.com/Magicrafter13/stembot/-/wikis/home\nYou may also submit bug reports and feature requests here: https://gitlab.com/Magicrafter13/stembot/-/issues');
	},
};
