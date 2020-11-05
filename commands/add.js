module.exports = {
	name: 'add',
	description: 'Create new roles, and sort them properly.',
	guildOnly: true,                         //
	args: true,                              // not implemented in develop yet!
	usage: '[-c] <classType> <classNumber>', //
	execute(message, args) {
		const classChannels = ['Computer Science', 'Engineering', 'Math', 'Physics'];
		const classRoles = ['Computer Scientists', 'Engineers', 'Mathematicians', 'Physicists'];
		const classes = ['CSE', 'Engr', 'Math', 'Phys'];
		// Check if user issuing command has permissions (or has Administrator)
		const guildMember = message.guild.member(message.author)
		if (!guildMember.hasPermission('MANAGE_CHANNELS', { checkAdmin: true }) || !guildMember.hasPermission('MANAGE_ROLES', { checkAdmin: true })) {
			message.reply('You do not have adequate permissions for this command to work.\nRequires: MANAGE_CHANNELS and MANAGE_ROLES');
			return;
		}
		switch (args.length) {
			case 2:
			case 3:
				let createChannel = false;
				if (args[0] === '-c' || args[0] === '--channel') {
					createChannel = true;
					args.shift();
					if (args.length < 2)
						return;
				}

				const classType = classes.map(function(str) { return str.toLowerCase(); }).indexOf(args[0].toLowerCase());
				if (classType >= 0) {
					// There's probably a better way to check if the argument is a number besides using RegEx
					// May want to look into this later
					if (args[1].match(/^\d+$/)) {
						message.channel.send(`Processing request...`);
						// Create Role
						const roleName = `${classes[classType]} ${args[1]}`;
						message.guild.roles.create({
							data: {
								name: roleName,
								position: message.guild.roles.cache.find(role => role.name === classRoles[classType]).position,
							},
							reason: `${message.author.username} requested role creation.`,
						})
						.then(console.log)
						.catch(console.error);
						message.channel.send(`Role created - ${roleName}`);
						// Create Channel
						if (createChannel) {
							const channelName = `${classes[classType].toLowerCase()}${args[1]}`;
							const newChannel = message.guild.channels.create(channelName, {
								type: 'text',
								parent: message.guild.channels.cache.find(channel => channel.type === 'category' && channel.name === classChannels[classType]),
								reason: `${message.author.username} requested role creation, with related channel.`,
							})
							.then(console.log)
							.catch(console.error);
							message.channel.send(`Channel created - <#${newChannel.id}>`);
						}
						message.channel.send('Finished.');
					}
					else message.channel.send(`err_syntax - ${args[1]} is not a positive integer.`);
				}
				else message.channel.send(`err_syntax - ${args[0]} is not a valid class type.`);
				break;
			case 1:
				if (args[0] === '-h' || args[0] === '--help') {
					message.channel.send('To-Do: Add help.');
					break;
				}
			default:
				message.channel.send('err_syntax');
				break;
		}
	},
};
