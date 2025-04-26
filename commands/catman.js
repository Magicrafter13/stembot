const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js'); // Discord.js library - wrapper for Discord API

async function setEmoji(interaction, manager, data) {
	// Determine data type
	const type = manager.fields ? 'field' : 'class';

	// Get emoji from user
	const emoji = interaction.options.getString("emoji", true);

	// Check if emoji already in use.
	if ((type === 'field' ? manager.fields : manager.classes).find(thing => thing.emoji === emoji))
		return interaction.reply({ content: `That emoji is already in use by another ${type === 'field' ? 'field' : 'class'}!`, flags: MessageFlags.Ephemeral });

	const old_emoji = data.emoji;

	// Update field/class
	data.emoji = emoji;

	await interaction.reply({ content: 'Reaction emoji updated.', flags: MessageFlags.Ephemeral });

	// Get the reaction data from the previous emoji if it exists
	if (manager.reactor.channel && manager.reactor.message) {
		interaction.guild.channels.fetch(manager.reactor.channel)
			.then(channel => {
				channel.messages.fetch(manager.reactor.message)
					.then(message => {
						old_reaction = message.reactions.cache.find(reaction => reaction.emoji.name === old_emoji);
						if (old_reaction)
							old_reaction.remove();
						/*message.react(emoji).catch(error => {
							console.error(error);
							interaction.followUp({ content: 'Could not add reaction, are you sure you gave a valid emoji?', flags: MessageFlags.Ephemeral});
						});*/
					})
					.catch(error => {
						console.error(error);
						interaction.followUp({ content: 'Failed to fetch embed message, make sure I have the proper permissions for the channel!', flags: MessageFlags.Ephemeral});
					});
			})
			.catch(error => {
				console.error(error);
				interaction.followUp({ content: 'Failed to fetch channel containing embed message, make sure I have the proper permissions for the category/server!', flags: MessageFlags.Ephemeral});
			});
	}
}

/*async function old_setEmoji(message, data, args) {
	if (args.length < 2)
		return message.channel.send('Syntax error, --set-emoji requires 2 arguments.');

	// Determine data type
	const type = data.fields ? 'manager' : 'field';

	const thing = type === 'manager'
		? message.guild.roles.resolve(args.shift().replace(/^<@&(\d+)>$/, `$1`)) // Get role's snowflake from user, then resolve to role.
		: args.shift().toLowerCase(); // Get class from user

	// Make sure we actually have an object to work with.
	if (!thing)
		return message.channel.send(`${type === 'manager' ? '2nd' : '3rd'} argument must be type: ${type === 'manager' ? 'Role' : 'class'}`);

	// Get emoji from user
	emoji = args.shift();

	const sub_thing = type === 'manager'
		? data.fields.find(field => field.id === thing.id)
		: data.classes.find(field_class => field_class.name === thing);

	// Same as before
	if (!sub_thing)
		return message.channel.send(`That ${type === 'manager' ? 'field' : 'class'} is not being managed/does not exist.`);

	// Check if emoji already in use.
	if ((type === 'manager' ? data.fields : data.classes).find(thing => thing.emoji === emoji))
		return message.channel.send(`That emoji is already in use by another ${type === 'manager' ? 'field' : 'class'}!`);

	// Get the reaction data from the previous emoji if it exists
	if (data.reactor.channel && data.reactor.message) {
		const reactMessage = message.guild.channels.resolve(data.reactor.channel).messages.resolve(data.reactor.message);
		const oldReaction = reactMessage.reactions.cache.find(r => r.emoji.name === sub_thing.emoji);
		\/*const oldUsers = oldReaction.users;
		console.log(oldUsers);*\/

		reactMessage.react(emoji)
			.then(newReaction => {
				\/*oldUsers.reaction = newReaction;
				newReaction.users = oldUsers;*\/
				reactMessage.reactions.resolve(oldReaction).remove();
				//console.log(newReaction.users);
			})
		.catch(console.error);
	}

	// Update field/class
	sub_thing.emoji = emoji;

	return message.channel.send('Reaction emoji updated.');
}*/

async function addClass(interaction, field) {
	// Get class from user
	const class_name = interaction.options.getString("name");

	// Make sure class is valid
	if (field.classes.find(class_data => class_data.name === class_name))
		return await interaction.reply({ content: `Field already contains this class.`, flags: MessageFlags.Ephemeral });

	// Find matching role
	const class_role = interaction.guild.roles.cache.find(role => role.name.startsWith(`${field.prefix} ${class_name}`));
	if (!class_role)
		return await interaction.reply({ content: `No role found with name \`${field.prefix} ${class_name}\`, you can create one by using \`create\` instead of \`add\`.`, flags: MessageFlags.Ephemeral });

	// Find matching channel
	const channel = interaction.guild.channels.cache.find(channel => channel.name.startsWith(`${field.prefix}${class_name}`.toLowerCase()) && channel.isTextBased());
	if (!channel)
		return await interaction.reply({ content: `No channel found with name \`${field.prefix}${class_name}\`, you can create one by using \`create:\` instead of \`add:\`.`, flags: MessageFlags.Ephemeral });

	// Get emoji from user, or null of none specified
	const emoji = interaction.options.getString("emoji", false);

	// Add new class to field
	field.classes.push({
		name: class_name,
		role: class_role.id,
		channel: channel.id,
		emoji: emoji,
	});

	// Update embed message
	if (field.reactor.message && emoji)
		editReactMessage(interaction, field);

	return await interaction.reply(`Adding ${class_role.toString()} and ${channel.toString()} to ${interaction.guild.roles.resolve(field.id).toString()} field.${emoji ? ` Emoji: ${emoji}.` : ''}`);
}

/*async function old_addClass(message, field, args) {
	// Get class from user
	class_name = args.shift().toLowerCase();

	// Make sure class is valid
	if (field.classes.indexOf(class_name) > -1)
		return message.channel.send(`${role.toString()} already contains this class.`);

	// Find matching role
	const class_role = message.guild.roles.cache.find(role => role.name.startsWith(`${field.prefix} ${class_name}`));

	// Make sure role exists
	if (!class_role)
		return message.channel.send(`No role found with name \`${field.prefix} ${class_name}\`, you can create one by using \`-c\` instead of \`-a\`.`);

	// Find matching channel
	channel = message.guild.channels.cache.find(channel => channel.name.startsWith(`${field.prefix.toLowerCase()}${class_name}`) && channel.isText());

	// Make sure channel exists
	if (!channel)
		return message.channel.send(`No channel found with name \`${field.prefix.toLowerCase()}${class_name}, you can create one by using \`-c\` instead of \`-a\`.`);

	// Get emoji from user, or null of none specified
	emoji = args.length ? args.shift() : null;

	// Add new class to field
	field.classes.push({
		name: class_name,
		role: class_role.id,
		channel: channel.id,
		emoji: emoji,
	});

	// Update embed message
	if (field.reactor.message && emoji)
		old_editReactMessage(message, field);

	return message.channel.send(`Adding ${class_role.toString()} and ${channel.toString()} to ${message.guild.roles.resolve(field.id).toString()} field.${emoji ? ` Emoji: ${emoji}.` : ''}`);
}*/

async function removeClass(interaction, field, field_role) {
	// Get class from user, then from the field
	const class_name = interaction.options.getString("name", true);
	const old_class = field.classes.find(class_data => class_data.name === class_name);
	if (!old_class)
		return await interaction.reply({ content: `${field_role} doesn't contain this class.`, flags: MessageFlags.Ephemeral });

	// Update field
	field.classes.splice(field.classes.indexOf(old_class), 1);

	// Update embed message
	if (field.reactor.message)
		editReactMessage(interaction, field);

	return await interaction.reply(`Removed \`${class_name}\` from list of classes.`);
}

/*async function old_removeClass(message, field, args) {
	// Get class from user, then from the field
	class_name = args.shift().toLowerCase();
	old_class = field.classes.find(field_class => field_class.name === class_name);

	// Make sure class is valid
	if (!old_class)
		return message.channel.send(`${role.toString()} doesn't contain this class.`);

	// Update field
	field.classes.splice(field.classes.indexOf(old_class), 1);

	// Update embed message
	if (field.reactor.message)
		old_editReactMessage(message, field);

	return message.channel.send(`Removed \`${class_name}\` from list of classes.`);
}*/

async function createClass(interaction, field) {
	// Get class from user
	const class_name = interaction.options.getString("name", true);
	if (field.classes.find(class_data => class_data.name === class_name))
		return await interaction.reply({ content: `${role.toString()} already contains this class.`, flags: MessageFlags.Ephemeral });

	// Get emoji from user, null if none specified
	emoji = interaction.options.getString("emoji", false);

	// Check if emoji is already in use
	if (emoji) {
		let alreadyInUse = false;
		field.classes.forEach(class_data => {
			if (class_data.emoji == emoji)
				return (alreadyInUse = true);
		});
		if (alreadyInUse)
			return interaction.reply({ content: 'This field already has a class with that emoji!', flags: MessageFlags.Ephemeral });
	}

	await interaction.reply("Creating role.");

	// Create class role
	const class_role = await interaction.guild.roles.create({
		name: `${field.prefix} ${class_name}`,
		position: field.classes.length ? interaction.guild.roles.resolve(field.classes[field.classes.length - 1].role).position : null,
		reason: `${interaction.user.username} added class ${class_name} to ${field.prefix}.`,
	});

	// Create class channel
	const class_channel = await interaction.guild.channels.create(`${field.prefix}${class_name}`, {
		type: 'GUILD_TEXT',
		parent: interaction.guild.channels.resolve(field.channel),
		reason: `${interaction.user.username} added class ${class_name} to ${field.prefix}.`,
		position: field.classes.length ? interaction.guild.channels.resolve(field.classes[field.classes.length - 1].channel).position + 1 : null,
	});

	// Move channel
	/*if (field.classes.length)
		class_channel.setPosition(message.guild.channels.resolve(field.classes[field.classes.length - 1].channel).rawPosition);*/

	// Add class to field
	field.classes.push({
		name: class_name,
		role: class_role.id,
		channel: class_channel.id,
		emoji: emoji,
	});

	// Update embed message
	if (field.reactor.message && emoji)
		editReactMessage(interaction, field);

	// Keep user informed
	return await interaction.editReply(`Added ${class_role.toString()} and ${class_channel.toString()} to ${interaction.guild.roles.resolve(field.id).toString()} info.${emoji ? ` Emoji: ${emoji}.` : ''}`);
}

/*async function old_createClass(message, field, args) {
	// Get class from user
	class_name = args.shift().toLowerCase();
	if (field.classes.find(field_class => field_class.name === class_name))
		return message.channel.send(`${role.toString()} already contains this class.`);

	// Get emoji from user, null if none specified
	emoji = args.length ? args.shift() : null;

	// Check if emoji is already in use
	if (emoji) {
		let alreadyInUse = false;
		field.classes.forEach(c => {
			if (c.emoji == emoji)
				return (alreadyInUse = true);
		});
		if (alreadyInUse)
			return message.channel.send('This field already has a class with that emoji!');
	}

	// Create class role
	const class_role = await message.guild.roles.create({
		name: `${field.prefix} ${class_name}`,
		position: field.classes.length ? message.guild.roles.resolve(field.classes[field.classes.length - 1].role).position : null,
		reason: `${message.author.username} added class ${class_name} to ${field.prefix}.`,
	});

	// Create class channel
	const class_channel = await message.guild.channels.create(`${field.prefix}${class_name}`, {
		type: 'GUILD_TEXT',
		parent: message.guild.channels.resolve(field.channel),
		reason: `${message.author.username} added class ${class_name} to ${field.prefix}.`,
		position: field.classes.length ? message.guild.channels.resolve(field.classes[field.classes.length - 1].channel).position + 1 : null,
	});

	// Move channel
	\/*if (field.classes.length)
		class_channel.setPosition(message.guild.channels.resolve(field.classes[field.classes.length - 1].channel).rawPosition);*\/

	// Add class to field
	field.classes.push({
		name: class_name,
		role: class_role.id,
		channel: class_channel.id,
		emoji: emoji,
	});

	// Update embed message
	if (field.reactor.message && emoji)
		old_editReactMessage(message, field);

	// Keep user informed
	return message.channel.send(`Adding ${class_role.toString()} and ${class_channel.toString()} to ${message.guild.roles.resolve(field.id).toString()} info.${emoji ? ` Emoji: ${emoji}.` : ''}`);
}*/

async function deleteClass(interaction, field, field_role) {
	// Get class from user, then from field
	const class_name = interaction.options.getString("name", true);
	const old_class = field.classes.find(class_data => class_data.name === class_name);
	if (!old_class)
		return await interaction.reply({ content: `${field_role} doesn't contain this class.`, flags: MessageFlags.Ephemeral });

	// Remove class from field
	await removeClass(interaction, field, field_role);

	//await interaction.followUp(`${class_name} removed from ${field.prefix}.`);

	// Delete role
	interaction.guild.roles.resolve(old_class.role).delete(`${interaction.user.username} deleted ${class_name} from ${field.prefix}.`)
	.then(interaction.followUp('Role deleted.'))
	.catch(console.error);
	/*message.guild.channels.fetch(old_class.channel).delete(`${message.author.username} deleted ${class_name} from ${fieldData.prefix}.`)
	.then(message.channel.send('Channel deleted.'))
	.catch(console.error);*/
	// Delete channel (except not, because I'm still not sure I want the bot to have such power...)
	return await interaction.followUp(`You may now delete ${interaction.guild.channels.resolve(old_class.channel).toString()}.`);
}

/*async function old_deleteClass(message, field, args) {
	// Get class from user, then from field
	class_name = args.shift().toLowerCase();
	old_class = field.classes.find(field_class => field_class.name === class_name);

	// Make sure class is valid
	if (!old_class)
		return message.channel.send(`${role.toString()} doesn't contain this class.`);

	// Remove class from field
	old_removeClass(message, field, [class_name]);

	// Delete role
	message.guild.roles.resolve(old_class.role).delete(`${message.author.username} deleted ${class_name} from ${field.prefix}.`)
	.then(message.channel.send('Role deleted.'))
	.catch(console.error);
	\/*message.guild.channels.fetch(old_class.channel).delete(`${message.author.username} deleted ${class_name} from ${fieldData.prefix}.`)
	.then(message.channel.send('Channel deleted.'))
	.catch(console.error);*\/
	// Delete channel (except not, because I'm still not sure I want the bot to have such power...)
	return message.channel.send(`You may now delete ${message.guild.channels.resolve(old_class.channel).toString()}.`);
}*/

async function createReactMessage(interaction, data) {
	const channel = interaction.options.getChannel("channel", true);
	if (!channel)
		return interaction.reply({ content: "Channel doesn't exist.", flags: MessageFlags.Ephemeral });

	// Delete previous react-role message if one exists
	if (data.reactor.message)
		deleteMessage(interaction.guild, data.reactor); //.catch(message.channel.send('WARNING: There was an error deleting the previous message.'));

	await interaction.reply({ content: 'Generating embed...', flags: MessageFlags.Ephemeral });

	// Create message.
	await channel.send('Please wait while embed is generated...')
		.then(message => {
			console.log("new message with id " + message.id);
			// Save message/channel id in reactor
			data.reactor = {
				message: message.id,
				channel: channel.id,
				text: interaction.options.getString("message", false) ? interaction.options.getString("message", false) : data.reactor.text,
			};

			// Generate embed
			editReactMessage(interaction, data)
			.then(interaction.editReply('Done!'))
			.catch(console.error);
		})
	.catch(console.error);
}

/*async function old_createReactMessage(message, data, args) {
	// Extract channel's unique snowflake from message
	const snowflake = args.shift().replace(/^<#(\d+)>$/, `$1`);
	const channel = message.guild.channels.resolve(snowflake);

	// See if we were given a valid snowflake
	if (!channel)
		return message.channel.send('Channel doesn\'t exist.');

	// Delete previous react-role message if one exists
	if (data.reactor.message)
		deleteMessage(message.guild, data.reactor); //.catch(message.channel.send('WARNING: There was an error deleting the previous message.'));

	// Create message.
	const embed_message = await channel.send('Please wait while embed is generated...');

	// Save message/channel id in reactor
	data.reactor = {
		message: embed_message.id,
		channel: channel.id,
		text: args.length ? args.join(' ') : data.reactor.text,
	};

	// Generate embed
	old_editReactMessage(message, data).catch(console.error);

	return;
}*/

async function editReactorText(interaction, manager) {
	// Get new string from user's command, and update message.
	manager.reactor.text = interaction.options.getString("message", true);

	// Update embed message
	editReactMessage(interaction, manager)
	.then(interaction.reply('Message text updated.'))
	.catch(console.error);

	return;
}

/*async function old_editReactorText(message, data, args) {
	// Get new string from user's command, and update message.
	data.reactor.text = args.join(' ');

	// Update embed message
	old_editReactMessage(message, data)
	.then(message.channel.send('Message text updated.'))
	.catch(console.error);

	return;
}*/

async function editReactMessage(interaction, manager) {
	if (!manager.reactor.message)
		return;

	// Check if 'manager' is from 'manager' or 'field'
	const type = manager.fields ? 'manager' : 'field';

	const things = type === 'manager'
		? manager.fields
			.filter(field => field.emoji)
			.map(field => `${field.emoji} - ${interaction.guild.channels.resolve(field.channel).name} Classes`)
			.join('\n')
		: manager.classes
			.filter(field_class => field_class.emoji)
			.map(field_class => `${field_class.emoji} - ${manager.prefix} ${field_class.name}`)
			.join('\n');

	// The CLark College logo shall remain here until a new picture is found for the bot.
	// TODO: this ^
	const embed = new EmbedBuilder()
	.setColor(type === 'manager' ? '#cc8800' : '#0099ff')
	.setTitle(type === 'manager'
		? 'Roles for this server. (Fields)'
		: `Class Roles for ${interaction.guild.channels.resolve(manager.channel).name}`)
	.setAuthor({ name: 'STEM Bot', iconURL: 'https://www.clackamas.edu/images/default-source/logos/nwac/clark_college_300x300.png', url: 'https://gitlab.com/Magicrafter13/stembot' })
	.setDescription(manager.reactor.text)
	//.setThumbnail('link')
	.addFields({ name: type === 'manager' ? 'Fields' : 'Classes', value: things === '' ? 'None set (use set-emoji).' : things })
	//.setImage('link')
	.setTimestamp()
	.setFooter({ text: 'Report bugs on our GitLab repository.' });

	const channel = interaction.guild.channels.resolve(manager.reactor.channel);
	channel.messages.edit(manager.reactor.message, { content: '', embeds: [ embed ] })
		.then(() => {
			(type === 'manager' ? manager.fields : manager.classes).forEach(t => {
				if (t.emoji)
					channel.messages.react(manager.reactor.message, t.emoji)
						.catch(error => {
							console.log(error);
							interaction.followUp({ content: `Could not react with ${t.emoji}, is this a valid emoji?`, flags: MessageFlags.Ephemeral});
						});
			});
		})
	.catch(console.error);
	return;
}

/*async function old_editReactMessage(message, data) {
	if (!data.reactor.message)
		return;

	// Check if 'data' is from 'manager' or 'field'
	const type = data.fields ? 'manager' : 'field';

	const things = type === 'manager'
		? data.fields.filter(field => field.emoji).map(field => `${field.emoji} - ${message.guild.channels.resolve(field.channel).name} Classes`).join('\n')
		: data.classes.filter(field_class => field_class.emoji).map(field_class => `${field_class.emoji} - ${data.prefix} ${field_class.name}`).join('\n');

	// The CLark College logo shall remain here until a new picture is found for the bot.
	// TODO: this ^
	const embed = new EmbedBuilder()
	.setColor(type === 'manager' ? '#cc8800' : '#0099ff')
	.setTitle(type === 'manager'
		? 'Roles for this server. (Fields)'
		: `Class Roles for ${message.guild.channels.resolve(data.channel).name}`)
	.setAuthor({ name: 'STEM Bot', iconURL: 'https://www.clackamas.edu/images/default-source/logos/nwac/clark_college_300x300.png', url: 'https://gitlab.com/Magicrafter13/stembot' })
	.setDescription(data.reactor.text)
	//.setThumbnail('link')
	.addFields({ name: type === 'manager' ? 'Fields' : 'Classes', value: things === '' ? 'None set (use --set-emoji).' : things })
	//.setImage('link')
	.setTimestamp()
	.setFooter({ text: 'Report bugs on our GitLab repository.' });

	const channel = message.guild.channels.resolve(data.reactor.channel)
	channel.messages.edit(data.reactor.message, { embeds: [ embed ] })
		.then(() => {
			(type === 'manager' ? data.fields : data.classes).forEach(t => {
				if (t.emoji)
					channel.messages.react(data.reactor.message, t.emoji);
			});
		})
	.catch(console.error);
	return;
}*/

async function deleteMessage(guild, reactor) {
	guild.channels.resolve(reactor.channel).messages.fetch(reactor.message)
	.then(m => m.delete())
	.catch(console.error);
}

async function swapRoles(interaction, manager) {
	const role1 = interaction.options.getRole("role1", true);
	const role2 = interaction.options.getRole("role2", true);

	const data1 = manager.fields
		? manager.fields.find(field => field.id === role1.id)
		: manager.classes.find(class_data => class_data.role === role1.id);
	if (!data1)
		return await interaction.reply({ content: manager.fields ? `${role1} is not a managed field role!` : `${role1} is not a class in this field!`, flags: MessageFlags.Ephemeral });
	const data2 = manager.fields
		? manager.fields.find(field => field.id === role2.id)
		: manager.classes.find(class_data => class_data.role === role2.id);
	if (!data2)
		return await interaction.reply({ content: manager.fields ? `${role2} is not a managed field role!` : `${role2} is not a class in this field!`, flags: MessageFlags.Ephemeral });

	const arr = manager.fields ? manager.fields : manager.classes;
	const index1 = arr.indexOf(data1);
	const index2 = arr.indexOf(data2);
	[arr[index1], arr[index2]] = [arr[index2], arr[index1]];

	if (!manager.fields) {
		const channel1 = interaction.guild.channels.resolve(data1.channel);
		const channel2 = interaction.guild.channels.resolve(data2.channel);

		const distance = Math.abs(index2 - index1);
		const pos1 = channel1.position;
		const pos2 = channel2.position;

		channel1.setPosition(pos2 - pos1 > 0 ? distance - 1 : -distance, { relative: true, reason: `${interaction.user.username} swapped 2 classes.` })
		.then(() => {
			channel2.setPosition(pos2 - pos1 > 0 ? -distance : distance - 1, { relative: true, reason: `${interaction.user.username} swapped 2 classes.` })
			.then(interaction.reply('Classes/channels swapped.'))
			.catch(console.error);
		})
		.catch(console.error);
	}
	else interaction.reply('Swapped fields.');

	return editReactMessage(interaction, manager);
}

/*async function old_swapRoles(message, manager, args) {
	if (args.length < 2)
		return message.channel.send('Syntax error, --swap requires 2 arguments.');

	const name1 = args.shift();
	const name2 = args.shift();

	const item1 = manager.fields ? manager.fields.find(field => `<@&${field.id}>` === name1) : manager.classes.find(the_class => the_class.name === name1);
	const item2 = manager.fields ? manager.fields.find(field => `<@&${field.id}>` === name2) : manager.classes.find(the_class => the_class.name === name2);

	if (!item1)
		return message.channel.send(`${name1} is not a managed ${manager.fields ? 'field role' : 'class name'}!`);
	if (!item2)
		return message.channel.send(`${name2} is not a managed ${manager.fields ? 'field role' : 'class name'}!`);

	const arr = manager.fields ? manager.fields : manager.classes;
	const index1 = arr.indexOf(item1);
	const index2 = arr.indexOf(item2);
	[arr[index1], arr[index2]] = [arr[index2], arr[index1]];

	if (!manager.fields) {
		const channel1 = message.guild.channels.resolve(item1.channel);
		const channel2 = message.guild.channels.resolve(item2.channel);

		const distance = Math.abs(index2 - index1);
		const pos1 = channel1.position;
		const pos2 = channel2.position;

		channel1.setPosition(pos2 - pos1 > 0 ? distance - 1 : -distance, { relative: true, reason: `${message.author} swapped 2 classes.` })
		.then(() => {
			channel2.setPosition(pos2 - pos1 > 0 ? -distance : distance - 1, { relative: true, reason: `${message.author} swapped 2 classes.` })
			.then(message.channel.send('Channels swapped.'))
			.catch(console.error);
		})
		.catch(console.error);
	}
	else message.channel.send('Field\'s swapped.');

	return old_editReactMessage(message, manager);
}*/

async function moveTop(interaction, manager) {
	const role = interaction.options.getRole("role", true);
	const data = manager.fields
		? manager.fields.find(field => field.id === role.id)
		: manager.classes.find(class_data => class_data.role === role.id);

	if (!data)
		return await interaction.reply({ content: manager.fields ? `${role} is not a managed field role!` : `${role} is not a class in this field!`, flags: MessageFlags.Ephemeral });

	const arr = manager.fields ? manager.fields : manager.classes;
	const index = arr.indexOf(data);
	arr.splice(index, 1);
	arr.unshift(data);

	if (!manager.fields) {
		const channel = interaction.guild.channels.resolve(data.channel);
		channel.setPosition(-index, { relative: true, reason: `${interaction.user.username} moved class to top.` })
		.then(interaction.reply({ content: 'Class/channel moved to top.', flags: MessageFlags.Ephemeral }))
		.catch(console.error);
	}
	else interaction.reply('Field moved to top.');

	return editReactMessage(interaction, manager);
}

/*async function old_moveTop(message, manager, args) {
	if (args.length < 1)
		return message.channel.send('Syntax error, --move-top requires 1 argument.');

	const name = args.shift();
	const item = manager.fields ? manager.fields.find(field => `<@&${field.id}>` === name) : manager.classes.find(the_class => the_class.name === name);

	if (!item)
		return message.channel.send(`${name} is not a managed ${manager.fields ? 'field role' : 'class name'}!`);

	const arr = manager.fields ? manager.fields : manager.classes;
	const index = arr.indexOf(item);
	arr.splice(index, 1);
	arr.unshift(item);

	if (!manager.fields) {
		const channel = message.guild.channels.resolve(item.channel);
		channel.setPosition(-index, { relative: true, reason: `${message.author} moved class to top.` })
		.then(message.channel.send('Class moved to top.'))
		.catch(console.error);
	}
	else message.channel.send('Field moved to top.');

	return old_editReactMessage(message, manager);
}*/

async function moveBottom(interaction, manager) {
	const role = interaction.options.getRole("role", true);
	const data = manager.fields
		? manager.fields.find(field => field.id === role.id)
		: manager.classes.find(class_data => class_data.role === role.id);

	if (!data)
		return await interaction.reply({ content: manager.fields ? `${role} is not a managed field role!` : `${role} is not a class in this field!`, flags: MessageFlags.Ephemeral });

	const arr = manager.fields ? manager.fields : manager.classes;
	const index = arr.indexOf(data);
	arr.splice(index, 1);
	arr.push(data);

	if (!manager.fields) {
		const channel = interaction.guild.channels.resolve(data.channel);
		channel.setPosition(arr.length - index - 1, { relative: true, reason: `${interaction.user.username} moved class to bottom.` })
		.then(interaction.reply({ content: 'Class/channel moved to bottom.', flags: MessageFlags.Ephemeral }))
		.catch(console.error);
	}
	else interaction.reply({ content: 'Field moved to bottom.', flags: MessageFlags.Ephemeral });

	return editReactMessage(interaction, manager);
}

/*async function old_moveBottom(message, manager, args) {
	if (args.length < 1)
		return message.channel.send('Syntax error, --move-bottom requires 1 argument.');

	const name = args.shift();
	const item = manager.fields ? manager.fields.find(field => `<@&${field.id}>` === name) : manager.classes.find(the_class => the_class.name === name);

	if (!item)
		return message.channel.send(`${name} is not a managed ${manager.fields ? 'field role' : 'class name'}!`);

	const arr = manager.fields ? manager.fields : manager.classes;
	const index = arr.indexOf(item);
	arr.splice(index, 1);
	arr.push(item);

	if (!manager.fields) {
		const channel = message.guild.channels.resolve(item.channel);
		channel.setPosition(arr.length - index - 1, { relative: true, reason: `${message.author} moved class to bottom.` })
		.then(message.channel.send('Class moved to bottom.'))
		.catch(console.error);
	}
	else message.channel.send('Field moved to bottom.');

	return old_editReactMessage(message, manager);
}*/

async function moveUp(interaction, manager) {
	const role = interaction.options.getRole("role", true);
	const data = manager.fields
		? manager.fields.find(field => field.id === role.id)
		: manager.classes.find(class_data => class_data.role === role.id);

	if (!data)
		return await interaction.reply({ content: manager.fields ? `${role} is not a managed field role!` : `${role} is not a class in this field!`, flags: MessageFlags.Ephemeral });

	const arr = manager.fields ? manager.fields : manager.classes;
	const index = arr.indexOf(data);
	if (index < 1)
		return interaction.reply({ content: 'That channel is already at the top!', flags: MessageFlags.Ephemeral });
	[arr[index], arr[index - 1]] = [arr[index - 1], arr[index]];

	if (!manager.fields) {
		const channel = interaction.guild.channels.resolve(data.channel);
		channel.setPosition(-1, { relative: true, reason: `${interaction.user.username} moved class up.` })
		.then(interaction.reply({ content: 'Class moved up.', flags: MessageFlags.Ephemeral }))
		.catch(console.error);
	}
	else interaction.reply({ content: 'Field moved up.', flags: MessageFlags.Ephemeral });

	return editReactMessage(interaction, manager);
}

/*async function old_moveUp(message, manager, args) {
	if (args.length < 1)
		return message.channel.send('Syntax error, --move-up requires 1 argument.');

	const name = args.shift();
	const item = manager.fields ? manager.fields.find(field => `<@&${field.id}>` === name) : manager.classes.find(the_class => the_class.name === name);

	if (!item)
		return message.channel.send(`${name} is not a managed ${manager.fields ? 'field role' : 'class name'}!`);

	const arr = manager.fields ? manager.fields : manager.classes;
	const index = arr.indexOf(item);
	if (index < 1)
		return message.channel.send('That channel is already at the top!');
	[arr[index], arr[index - 1]] = [arr[index - 1], arr[index]];

	if (!manager.fields) {
		const channel = message.guild.channels.resolve(item.channel);
		channel.setPosition(-1, { relative: true, reason: `${message.author} moved class up.` })
		.then(message.channel.send('Class moved up.'))
		.catch(console.error);
	}
	else message.channel.send('Field moved up.');

	return old_editReactMessage(message, manager);
}*/

async function moveDown(interaction, manager) {
	const role = interaction.options.getRole("role", true);
	const data = manager.fields
		? manager.fields.find(field => field.id === role.id)
		: manager.classes.find(class_data => class_data.role === role.id);

	if (!data)
		return await interaction.reply({ content: manager.fields ? `${role} is not a managed field role!` : `${role} is not a class in this field!`, flags: MessageFlags.Ephemeral });

	const arr = manager.fields ? manager.fields : manager.classes;
	const index = arr.indexOf(data);
	if (index == arr.length - 1)
		return interaction.reply({ content: 'That channel is already at the bottom!', flags: MessageFlags.Ephemeral });
	[arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];

	if (!manager.fields) {
		const channel = interaction.guild.channels.resolve(data.channel);
		channel.setPosition(1, { relative: true, reason: `${interaction.user.username} moved class down.` })
		.then(interaction.reply({ content: 'Class moved down.', flags: MessageFlags.Ephemeral }))
		.catch(console.error);
	}
	else interaction.reply({ content: 'Field moved down.', flags: MessageFlags.Ephemeral });

	return editReactMessage(interaction, manager);
}

/*async function old_moveDown(message, manager, args) {
	if (args.length < 1)
		return message.channel.send('Syntax error, --move-down requires 1 argument.');

	const name = args.shift();
	const item = manager.fields ? manager.fields.find(field => `<@&${field.id}>` === name) : manager.classes.find(the_class => the_class.name === name);

	if (!item)
		return message.channel.send(`${name} is not a managed ${manager.fields ? 'field role' : 'class name'}!`);

	const arr = manager.fields ? manager.fields : manager.classes;
	const index = arr.indexOf(item);
	if (index == arr.length - 1)
		return message.channel.send('That channel is already at the bottom!');
	[arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];

	if (!manager.fields) {
		const channel = message.guild.channels.resolve(item.channel);
		channel.setPosition(1, { relative: true, reason: `${message.author} moved class down.` })
		.then(message.channel.send('Class moved down.'))
		.catch(console.error);
	}
	else message.channel.send('Field moved down.');

	return old_editReactMessage(message, manager);
}*/

const newReactor = {
	message: null,
	channel: null,
	text: 'React to this message for roles!',
};

const newField = {
	id: null,
	channel: null,
	prefix: null,
	emoji: null,
	reactor: newReactor,
	classes: [],
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('catman')
		.setDescription('Manage Class Subjects/Fields')
		.addSubcommand(subcommand => subcommand
			.setName("list")
			.setDescription("Lists all fields currently stored in the manager."))
		.addSubcommand(subcommand => subcommand
			.setName("set-emoji")
			.setDescription("Change a field or class emoji.")
			.addStringOption(option => option
				.setName("emoji")
				.setDescription("Which emoji do you want to use?")
				.setRequired(true))
			.addRoleOption(option => option
				.setName("field")
				.setDescription("Which field do you want to change?")
				.setRequired(true))
			.addRoleOption(option => option
				.setName("class")
				.setDescription("Which class do you want to change?")
				.setRequired(false)))
		.addSubcommand(subcommand => subcommand
			.setName("create-message")
			.setDescription("Generate a react-role embed.")
			.addChannelOption(option => option
				.setName("channel")
				.setDescription("Which channel do you want the message to be sent to?")
				.setRequired(true))
			.addStringOption(option => option
				.setName("message")
				.setDescription("What should the embed say?")
				.setRequired(false))
			.addRoleOption(option => option
				.setName("field")
				.setDescription("Generate an embed for which field?")
				.setRequired(false)))
		.addSubcommand(subcommand => subcommand
			.setName("edit-message")
			.setDescription("Edit text of a react-role embed.")
			.addStringOption(option => option
				.setName("message")
				.setDescription("What should the embed say?")
				.setRequired(true))
			.addRoleOption(option => option
				.setName("field")
				.setDescription("Generate an embed for which field?")
				.setRequired(false)))
		.addSubcommand(subcommand => subcommand
			.setName("swap")
			.setDescription("Swap list order of fields/classes.")
			.addRoleOption(option => option
				.setName("role1")
				.setDescription("First thing to swap:")
				.setRequired(true))
			.addRoleOption(option => option
				.setName("role2")
				.setDescription("Second thing to swap:")
				.setRequired(true))
			.addRoleOption(option => option
				.setName("field")
				.setDescription("Enter a field to swap classes in:")
				.setRequired(false)))
		.addSubcommand(subcommand => subcommand
			.setName("move-top")
			.setDescription("Move field/class to the top of the list.")
			.addRoleOption(option => option
				.setName("role")
				.setDescription("Thing to move to the top:")
				.setRequired(true))
			.addRoleOption(option => option
				.setName("field")
				.setDescription("Enter a field to move a class in:")
				.setRequired(false)))
		.addSubcommand(subcommand => subcommand
			.setName("move-bottom")
			.setDescription("Move field/class to the bottom of the list.")
			.addRoleOption(option => option
				.setName("role")
				.setDescription("Thing to move to the bottom:")
				.setRequired(true))
			.addRoleOption(option => option
				.setName("field")
				.setDescription("Enter a field to move a class in:")
				.setRequired(false)))
		.addSubcommand(subcommand => subcommand
			.setName("move-up")
			.setDescription("Move field/class up one position in the list.")
			.addRoleOption(option => option
				.setName("role")
				.setDescription("Thing to move up:")
				.setRequired(true))
			.addRoleOption(option => option
				.setName("field")
				.setDescription("Enter a field to move a class in:")
				.setRequired(false)))
		.addSubcommand(subcommand => subcommand
			.setName("move-down")
			.setDescription("Move field/class down one position in the list.")
			.addRoleOption(option => option
				.setName("role")
				.setDescription("Thing to move down:")
				.setRequired(true))
			.addRoleOption(option => option
				.setName("field")
				.setDescription("Enter a field to move a class in:")
				.setRequired(false)))
		.addSubcommand(subcommand => subcommand
			.setName("set-category")
			.setDescription("Set the channel category for a field. (Creates field if it doesn't exist.)")
			.addRoleOption(option => option
				.setName("field")
				.setDescription("What field would you like to change?")
				.setRequired(true))
			.addChannelOption(option => option
				.setName("category")
				.setDescription("What channel category would you like to associate with this field?")
				.setRequired(true)))
		.addSubcommand(subcommand => subcommand
			.setName("set-prefix")
			.setDescription("Set the role/channel prefix for a field. (Creates field if it doesn't exist.)")
			.addRoleOption(option => option
				.setName("field")
				.setDescription("What field would you like to change?")
				.setRequired(true))
			.addStringOption(option => option
				.setName("prefix")
				.setDescription("What do roles/channels in this field start with?")
				.setRequired(true)))
		.addSubcommand(subcommand => subcommand
			.setName("print")
			.setDescription("Show information about a field.")
			.addRoleOption(option => option
				.setName("field")
				.setDescription("What field would you like to see?")
				.setRequired(true)))
		.addSubcommand(subcommand => subcommand
			.setName("add")
			.setDescription("Add an existing class role to a field.")
			.addRoleOption(option => option
				.setName("field")
				.setDescription("What field should this class be added to?")
				.setRequired(true))
			.addStringOption(option => option
				.setName("name")
				.setDescription("What is the name/id of this class? (i.e. '120' from CS 120)")
				.setRequired(true))
			.addStringOption(option => option
				.setName("emoji")
				.setDescription("What emoji would you like to associate with this class?")
				.setRequired(false)))
		.addSubcommand(subcommand => subcommand
			.setName("create")
			.setDescription("Add a new class role to a field.")
			.addRoleOption(option => option
				.setName("field")
				.setDescription("What field should this class be added to?")
				.setRequired(true))
			.addStringOption(option => option
				.setName("name")
				.setDescription("What is the name/id of this class? (i.e. '120' from CS 120)")
				.setRequired(true))
			.addStringOption(option => option
				.setName("emoji")
				.setDescription("What emoji would you like to associate with this class?")
				.setRequired(false)))
		.addSubcommand(subcommand => subcommand
			.setName("remove")
			.setDescription("Remove a class role from the field manager.")
			.addRoleOption(option => option
				.setName("field")
				.setDescription("What field do you want to remove a class from?")
				.setRequired(true))
			.addStringOption(option => option
				.setName("name")
				.setDescription("What is the name/id of this class? (i.e. '120' from CS 120)")
				.setRequired(true)))
		.addSubcommand(subcommand => subcommand
			.setName("delete")
			.setDescription("Delete a class from the manager, and its role.")
			.addRoleOption(option => option
				.setName("field")
				.setDescription("What field do you want to delete a class from?")
				.setRequired(true))
			.addStringOption(option => option
				.setName("name")
				.setDescription("What is the name/id of this class? (i.e. '120' from CS 120)")
				.setRequired(true)))
		.addSubcommand(subcommand => subcommand
			.setName("purge")
			.setDescription("Delete all data associated with a field from the manager.")
			.addRoleOption(option => option
				.setName("field")
				.setDescription("What field do you want to purge?")
				.setRequired(true))),
	guildOnly: true,
	cooldown: 0.5,
	async execute(interaction) {
		// Check if user has required permissions.
		if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageChannels | PermissionFlagsBits.ManageRoles, { checkAdmin: true }))
			return await interaction.reply({ content: 'You do not have adequate permissions for this command to work.\nRequires: MANAGE_CHANNELS and MANAGE_ROLES', flags: MessageFlags.Ephemeral });

		const fieldDB = interaction.client.settings.get('categories');
		let manager = await fieldDB.get(interaction.guildId)
		.then(manager => manager ? manager : { fields: [], reactor: newReactor })
		.catch(console.error);
		if (!manager)
			return await interaction.reply({ content: "There was an error reading the database!", flags: MessageFlags.Ephemeral });

		// Guild has version 3.0 data = upgrade to 4
		if (!manager.fields) {
			manager = {
				fields: manager,
				reactor: newReactor,
			};
		}

		const field_role = interaction.options.getRole("field");
		// TODO figure out a way to make field a const
		let field = field_role ? manager.fields.find(field => field.id === field_role.id) : null;
		/*if (field === undefined)
			return await interaction.reply(`${field_role} is not currently stored in the manager. Add it with:\n>`); // TODO: easier way to add fields than current implementation...*/
		if (field) {
			/*
			 * Update field (when users have data from older version of bot)
			 * From Version 3
			 */
			if (!field.reactor) {
				field = {
					id: field.id,
					channel: field.channel,
					prefix: field.prefix,
					emoji: null,
					reactor: newReactor,
					classes: (() => {
						let classes = [];
						for (let i = 0; i < field.classes.length; i++) {
							classes.push({
								name: field.classes[i],
								role: field.roles[i],
								channel: field.channels[i],
								emoji: null,
							});
						}
						return classes;
					}) (),
				};
			}
		}
		const class_role = interaction.options.getRole("class");
		if (class_role && !field_role)
			return await interaction.reply({ content: "You can't specify a class without a field!", flags: MessageFlags.Ephemeral });
		const class_data = class_role ? field.classes.find(c => c.role === class_role.id) : null;
		if (class_data === undefined)
			return await interaction.reply({ content: `${class_role} is not part of the ${field_role} field.`, flags: MessageFlags.Ephemeral }); // TODO also here

		switch (interaction.options.getSubcommand()) {
			// List fields currently in manager.
			case 'list': {
				let message = `The following roles have field information:\n`;
				manager.fields.map(f => f.id).forEach(snowflake => {
					const role = interaction.guild.roles.resolve(snowflake);
					message += `${(role ? role.toString() : 'Could not resolve role!')}\n`
				});
				return await interaction.reply(message);
				return await interaction.reply(`The following roles have field information:\n${manager.fields.map(f => interaction.guild.roles.cache.find(r => r.id === f.id).toString()).join('\n')}`);
			}
			// Set field's emoji for react-role message.
			case 'set-emoji':
				/*if (class_role)
				field = manager.fields.find(field => field.id === role.id);*/
				setEmoji(interaction, class_data ? field : manager, class_data ? class_data : field)
					.then(() => {
						// Update embed message
						editReactMessage(interaction, class_data ? field : manager)
						.then(() => fieldDB.set(interaction.guildId, manager)) // Update database
						.catch(console.error);
					})
				.catch(console.error);

				break;
			case 'create-message':
				if (field_role && !field)
					return await interaction.reply({ content: `No field information set for ${role.toString()}`, flags: MessageFlags.Ephemeral });
				if (!(field ? field.classes : manager.fields).length)
					return await interaction.reply({ content: `The ${field ? "field" : "manager"} is empty, you need to add ${field ? "classes" : "fields"} first.\n> `, flags: MessageFlags.Ephemeral}); // TODO sample command

				// Create embed message
				console.log(`Creating ${field ? "class" : "field"} react-role embed.`);
				await createReactMessage(interaction, field ? field : manager);

				break;
			// Edit text of react-role message.
			case 'edit-message':
				if (field_role && !field)
					return await interaction.reply({ content: `No field information set for ${role.toString()}`, flags: MessageFlags.Ephemeral });
				if (!(field ? field.classes : manager.fields).length)
					return await interaction.reply({ content: `The ${field ? "field" : "manager"} is empty, you need to add ${field ? "classes" : "fields"} first.\n> /catman add \`field:\` ${field_role} \`name:\` ...`, flags: MessageFlags.Ephemeral}); // TODO sample command
				// Make sure there actually *is* a message to edit...
				if (!(field ? field : manager).reactor.message)
					return await interaction.reply({ content: `There is no message! Create one with:\n> /catman create-message \`channel:\` ... \`message:\` ${interaction.options.getString("message", false)} ${interaction.options.getRole("field", false) ? `\`field:\` ${interaction.options.getRole("field", false)}` : ""}`, flags: MessageFlags.Ephemeral });

				// Update reactor
				editReactorText(interaction, field ? field : manager)
				.then(() => fieldDB.set(interaction.guildId, manager)) // Update database
				.catch(console.error);

				break;
			// Swap 2 field's position in list
			case 'swap':
				if (field_role && !field)
					return await interaction.reply({ content: `No field information set for ${role.toString()}`, flags: MessageFlags.Ephemeral });
				if (!(field ? field.classes : manager.fields).length)
					return await interaction.reply({ content: `The ${field ? "field" : "manager"} is empty, you need to add ${field ? "classes" : "fields"} first.\n> `, flags: MessageFlags.Ephemeral}); // TODO sample command

				swapRoles(interaction, field ? field : manager)
				.then(() => fieldDB.set(interaction.guildId, manager)) // Update database
				.catch(console.error);
				break;
			// Move field to top of list
			case 'move-top':
				if (field_role && !field)
					return await interaction.reply({ content: `No field information set for ${role.toString()}`, flags: MessageFlags.Ephemeral });
				if (!(field ? field.classes : manager.fields).length)
					return await interaction.reply({ content: `The ${field ? "field" : "manager"} is empty, you need to add ${field ? "classes" : "fields"} first.\n> `, flags: MessageFlags.Ephemeral}); // TODO sample command

				moveTop(interaction, field ? field : manager)
				.then(() => fieldDB.set(interaction.guildId, manager)) // Update database
				.catch(console.error);
				break;
			// Move field to bottom of list
			case 'move-bottom':
				if (field_role && !field)
					return await interaction.reply({ content: `No field information set for ${role.toString()}`, flags: MessageFlags.Ephemeral });
				if (!(field ? field.classes : manager.fields).length)
					return await interaction.reply({ content: `The ${field ? "field" : "manager"} is empty, you need to add ${field ? "classes" : "fields"} first.\n> `, flags: MessageFlags.Ephemeral}); // TODO sample command

				moveBottom(interaction, field ? field : manager)
				.then(() => fieldDB.set(interaction.guildId, manager)) // Update database
				.catch(console.error);
				break;
			// Move field up in list
			case 'move-up':
				if (field_role && !field)
					return await interaction.reply({ content: `No field information set for ${role.toString()}`, flags: MessageFlags.Ephemeral });
				if (!(field ? field.classes : manager.fields).length)
					return await interaction.reply({ content: `The ${field ? "field" : "manager"} is empty, you need to add ${field ? "classes" : "fields"} first.\n> `, flags: MessageFlags.Ephemeral}); // TODO sample command

				moveUp(interaction, field ? field : manager)
				.then(() => fieldDB.set(interaction.guildId, manager)) // Update database
				.catch(console.error);
				break;
			// Move field down in list
			case 'move-down':
				if (field_role && !field)
					return await interaction.reply({ content: `No field information set for ${role.toString()}`, flags: MessageFlags.Ephemeral });
				if (!(field ? field.classes : manager.fields).length)
					return await interaction.reply({ content: `The ${field ? "field" : "manager"} is empty, you need to add ${field ? "classes" : "fields"} first.\n> `, flags: MessageFlags.Ephemeral}); // TODO sample command

				moveDown(interaction, field ? field : manager)
				.then(() => fieldDB.set(interaction.guildId, manager)) // Update database
				.catch(console.error);
				break;
			case 'set-category':
				const category = interaction.options.getChannel("category", true);

				// Make sure user provided a valid category name
				if (!category.type === "GUILD_CATEGORY")
					return await interaction.reply({ content: `${category} is not a channel category!`, flags: MessageFlags.Ephemeral });

				if (field) {
					// Update existing field object's category
					field.channel = category.id;

					// Update embed message
					editReactMessage(interaction, field)
					.then(() => fieldDB.set(interaction.guildId, manager)) // Update database
					.catch(console.error);

					return await interaction.reply(`Updated field category to ${category.toString()}.`);
				}

				// Create new field object
				field = newField;

				// Set its role id
				field.id = field_role.id;
				// Set its category
				field.channel = category.id;

				// Add it to the manager
				manager.fields.push(field);

				interaction.reply(`Created field info for ${field_role}, under category ${category}.`);
				break;
			case 'set-prefix':
				// Get new field prefix from user
				const prefix = interaction.options.getString("prefix", true);

				if (field) {
					// Update existing field object's prefix
					field.prefix = prefix;

					// Update embed message
					editReactMessage(interaction, field)
					.then(() => fieldDB.set(interaction.guildId, manager)) // Update database
					.catch(console.error);

					return await interaction.reply({ content: `Updated field prefix to \`${prefix}\`.`, flags: MessageFlags.Ephemeral});
				}

				// Create new field object
				field = newField;

				// Set its role id
				field.id = role.id;
				// Set its prefix
				field.prefix = prefix;

				// Add it to the manager
				manager.fields.push(field);

				interaction.reply(`Created field info for ${field_role}, with prefix \`${prefix}\`.`);
				break;
			case 'print':
				if (!field)
					return await interaction.reply({ content: `No field information set for ${field_role}`, flags: MessageFlags.Ephemeral });

				// TODO this is absolutely terrible, make an embed or something
				let message = "";
				if (field.channel) {
					const category = await interaction.guild.channels.fetch(field.channel).catch(console.error);
					message += category ? `Channel Category: ${category.toString()}` : 'Could not fetch category!';
				}
				else message += "No Channel Category Set";
				message += `\n${field.prefix ? `Prefix: ${field.prefix}` : 'No Prefix Set'}\n`;
				if (field.reactor.channel && field.reactor.message) {
					message += "React Role Message: ";
					const channel = await interaction.guild.channels.fetch(field.reactor.channel).catch(console.error);
					if (channel) {
						const embed = await channel.messages.fetch(field.reactor.message).catch(console.error);
						message += embed ? embed.url : 'Could not fetch message!';
					}
					else message += 'Could not fetch channel!';
				}
				else message += "No React Role Message Created";
				message += `\nClasses: [ ${field.classes.map(c => c.name).join(', ')} ]\nRoles: [ `;
				let first = true;
				field.classes.map(c => c.role).forEach(snowflake => {
					if (first)
						first = false;
					else
						message += ', ';
					const role = interaction.guild.roles.resolve(snowflake);
					message += role ? role.toString() : 'Could not fetch role!';
				});
				message += ` ]\nChannels: [ `;
				first = true;
				field.classes.map(c => c.channel).forEach(snowflake => {
					if (first)
						first = false;
					else
						message += ', ';
					const channel = interaction.guild.channels.resolve(snowflake);
					message += channel ? channel.toString() : 'Could not fetch channel!';
				});
				message += ` ]\nEmoji: [ ${field.classes.map(c => c.emoji).join(', ')} ]`;

				return await interaction.reply(message);
			case 'add':
				if (!field)
					return await interaction.reply({ content: `No field information set for ${field_role}`, flags: MessageFlags.Ephemeral });
				if (!field.channel)
					return await interaction.reply({ content: `${field_role} has no channel category defined, please use \`/catman set-category field: ${field_role}\`.`, flags: MessageFlags.Ephemeral});
				if (!field.prefix)
					return await interaction.reply({ content: `${field_role} has no prefix defined, please use \`/catman set-prefix field: ${field_role}\`.`, flags: MessageFlags.Ephemeral });

				return addClass(interaction, field, class_role)
				.then(() => fieldDB.set(interaction.guildId, manager)) // Update database
				.catch(console.error);
			case 'create':
				if (!field)
					return await interaction.reply({ content: `No field information set for ${field_role}`, flags: MessageFlags.Ephemeral });
				if (!field.channel)
					return await interaction.reply({ content: `${field_role} has no channel category defined, please use \`/catman set-category field: ${field_role}\`.`, flags: MessageFlags.Ephemeral});
				if (!field.prefix)
					return await interaction.reply({ content: `${field_role} has no prefix defined, please use \`/catman set-prefix field: ${field_role}\`.`, flags: MessageFlags.Ephemeral });

				return createClass(interaction, field)
				.then(() => fieldDB.set(interaction.guildId, manager)) // Update database
				.catch(console.error);
			case 'remove':
				if (!field)
					return await interaction.reply({ content: `No field information set for ${field_role}`, flags: MessageFlags.Ephemeral });
				if (!field.channel)
					return await interaction.reply({ content: `${field_role} has no channel category defined, please use \`/catman set-category field: ${field_role}\`.`, flags: MessageFlags.Ephemeral});
				if (!field.prefix)
					return await interaction.reply({ content: `${field_role} has no prefix defined, please use \`/catman set-prefix field: ${field_role}\`.`, flags: MessageFlags.Ephemeral });

				await removeClass(interaction, field, field_role);

				break;
			case 'delete':
				if (!field)
					return await interaction.reply({ content: `No field information set for ${field_role}`, flags: MessageFlags.Ephemeral });
				if (!field.channel)
					return await interaction.reply({ content: `${field_role} has no channel category defined, please use \`/catman set-category field: ${field_role}\`.`, flags: MessageFlags.Ephemeral});
				if (!field.prefix)
					return await interaction.reply({ content: `${field_role} has no prefix defined, please use \`/catman set-prefix field: ${field_role}\`.`, flags: MessageFlags.Ephemeral });

				return deleteClass(interaction, field, field_role)
				.then(() => fieldDB.set(interaction.guildId, manager)) // Update database
				.catch(console.error);
			case 'purge':
				if (!field)
					return await interaction.reply({ content: `No field information set for ${field_role}`, flags: MessageFlags.Ephemeral });

				// Cleanup react-role message if one exists.
				if (field.reactor.message)
					deleteMessage(interaction.guild, field.reactor); //.catch(message.channel.send('WARNING: There was an error deleting the previous message.'));

				// Update manager
				manager.fields.splice(manager.fields.indexOf(field), 1);

				await interaction.reply(`${field_role} field no longer being managed.`);
				break;
		}
		fieldDB.set(interaction.guildId, manager); // Update database
	},
	/*argsMin: 1,
	argsMax: -1,
	old_execute(message, args, settings) {
		// Check if user has required permissions.
		const guildMember = message.guild.members.cache.get(message.author.id);
		if (!guildMember.permissions.has(Permissions.FLAGS.MANAGE_CHANNELS, { checkAdmin: true }) || !guildMember.permissions.has(Permissions.FLAGS.MANAGE_ROLES, { checkAdmin: true }))
			return message.reply('You do not have adequate permissions for this command to work.\nRequires: MANAGE_CHANNELS and MANAGE_ROLES');

		const fieldDB = settings.get('categories');
		fieldDB.get(message.guild.id)
			.then(async function (val) {
				let manager;

				// Guild has no data in database yet
				if (!val) {
					manager = {
						fields: [],
						reactor: newReactor,
					};
				}
				else {
					manager = val;

					// Guild has version 3.0 data = upgrade to 4
					if (!val.fields) {
						manager = {
							fields: val,
							reactor: newReactor,
						};
					}
				}

				let field;

				const command = !args.length ? '--list' : args.shift();

				switch (command) {
					// List fields currently in manager.
					case '-l': case '--list':
						return message.channel.send(`The following roles have field information:\n${manager.fields.map(f => message.guild.roles.cache.find(r => r.id === f.id).toString()).join('\n')}`)
					// Set field's emoji for react-role message.
					case '-se': case '--set-emoji':
						old_setEmoji(message, manager, args)
							.then(() => {
								// Update embed message
								old_editReactMessage(message, manager)
								.then(() => fieldDB.set(message.guild.id, manager)) // Update database
								.catch(console.error);
							})
						.catch(console.error);

						break;
					case '-cm': case '--create-message':
						if (!manager.fields.length)
							return message.channel.send('There are no fields being managed yet, message would be pointless!');

						// Create embed message
						old_createReactMessage(message, manager, args)
						.then(() => fieldDB.set(message.guild.id, manager)) // Update database
						.catch (console.error);

						break;
					// Edit text of react-role message.
					case '-em': case '--edit-message':
						// Make sure there actually *is* a message to edit...
						if (!manager.reactor.message)
							return message.channel.send('There is no message! Create one with --create-message.');

						// Update reactor
						old_editReactorText(message, manager, args)
						.then(() => fieldDB.set(message.guild.id, manager)) // Update database
						.catch(console.error);

						break;
					// Swap 2 field's position in list
					case '-s': case '--swap':
						if (!manager.fields.length)
							return message.channel.send('There are no fields being managed yet. There isn\'t anything to swap?');

						old_swapRoles(message, manager, args)
						.then(() => fieldDB.set(message.guild.id, manager)) // Update database
						.catch(console.error);
						break;
					// Move field to top of list
					case '-mt': case '--move-top':
						if (!manager.fields.length)
							return message.channel.send('There are no fields being managed yet. There isn\'t anything to move?');

						old_moveTop(message, manager, args)
						.then(() => fieldDB.set(message.guild.id, manager)) // Update database
						.catch(console.error);
						break;
					// Move field to bottom of list
					case '-mb': case '--move-bottom':
						if (!manager.fields.length)
							return message.channel.send('There are no fields being managed yet. There isn\'t anything to move?');

						old_moveBottom(message, manager, args)
						.then(() => fieldDB.set(message.guild.id, manager)) // Update database
						.catch(console.error);
						break;
					// Move field up in list
					case '-mu': case '--move-up':
						if (!manager.fields.length)
							return message.channel.send('There are no fields being managed yet. There isn\'t anything to move?');

						old_moveUp(message, manager, args)
						.then(() => fieldDB.set(message.guild.id, manager)) // Update database
						.catch(console.error);
						break;
					// Move field down in list
					case '-md': case '--move-down':
						if (!manager.fields.length)
							return message.channel.send('There are no fields being managed yet. There isn\'t anything to move?');

						old_moveDown(message, manager, args)
						.then(() => fieldDB.set(message.guild.id, manager)) // Update database
						.catch(console.error);
						break;
					// No known command found, assume user specified a field role and wants to run one of those commands.
					default:
						// Get role snowflake from user, and resolve to role
						const snowflake = command.replace(/^<@&(\d+)>$/, `$1`);
						const role = message.guild.roles.resolve(snowflake);

						// Check if snowflake was valid
						if (!role)
							return message.channel.send('1st argument must be a valid command, or a Role!');

						// Field information for specified role.
						// TODO figure out a way to make field a const
						field = manager.fields.find(field => field.id === role.id);
						if (field) {
							// Update field (when users have data from older version of bot)
							// From Version 3
							if (!field.reactor) {
								field = {
									id: field.id,
									channel: field.channel,
									prefix: field.prefix,
									emoji: null,
									reactor: newReactor,
									classes: (() => {
										let classes = [];
										for (let i = 0; i < field.classes.length; i++) {
											classes.push({
												name: field.classes[i],
												role: field.roles[i],
												channel: field.channels[i],
												emoji: null,
											});
										}
										return classes;
									}) (),
								};
							}
						}

						// If field has a non-null reactor, and the message doesn't resolve, fetch it from Discord (and cache it)
						// This fixes the issue of the bot restarting, and losing its cache of messages (which will cause errors with some commands)
						\/*
						 / TODO for some reason, if this encounters an error (like the message not existing) the whole command stops.
						 / The bot will still respond to commands, it doesn't crash, but it's like it returns here?
						 / Temporary fix: add a -dm --delete-message command to be used in this situation
						 /
						 / Jan 1: But wait, that wouldn't change anything, since to run the --delete-message code, it would have to get
						 / past this point, which as stated before is where the issue happens...
						 / Ugh, just push it to release I don't even care right now
						 *\/
//						if (field && field.reactor.message && !message.guild.channels.resolve(field.reactor.channel).messages.cache.has(field.reactor.message)) {
//							message.channel.send('Caching react-role message...');
//							await message.guild.channels.resolve(field.reactor.channel).messages.fetch(field.reactor.message)
//						}

						//console.log(`Message cached\n${message.guild.channels.resolve(field.reactor.channel).messages.resolve(field.reactor.message)}\nEND`);

						const cmd = args.shift();
						switch (cmd) {
							case '-sc': case '--set-category':
								// Channel Categories cannot be tagged in a message, so we are forced to do a search by name.
								const category_name = args.join(' ');
								const category = message.guild.channels.cache.find(channel => channel.name === category_name);

								// Make sure user provided a valid category name
								if (!category)
									return message.channel.send('3rd argument must be type: Channel Category Name');

								if (field) {
									// Update existing field object's category
									field.channel = category.id;

									// Update embed message
									return old_editReactMessage(message, field)
										.then(() => {
											fieldDB.set(message.guild.id, manager); // Update database

											message.channel.send(`Updated field category to ${category.toString()}.`);
										})
									.catch(console.error);
								}

								// Create new field object
								field = newField;

								// Set its role id
								field.id = role.id;
								// Set its category
								field.channel = category.id;

								// Add it to the manager
								manager.fields.push(field);

								message.channel.send(`Created field info for ${role.toString()}, under category ${category.toString()}.`);
								break;
							case '-sp': case '--set-prefix':
								// Get new field prefix from user
								const prefix = args.shift();

								if (field) {
									// Update existing field object's prefix
									field.prefix = prefix;

									// Update embed message
									return old_editReactMessage(message, field)
										.then(() => {
											fieldDB.set(message.guild.id, manager); // Update database

											message.channel.send(`Updated field prefix to \`${prefix}\`.`);
										})
									.catch(console.error);
								}

								// Create new field object
								field = newField;

								// Set its role id
								field.id = role.id;
								// Set its prefix
								field.prefix = prefix;

								// Add it to the manager
								manager.fields.push(field);

								message.channel.send(`Created field info for ${role.toString()}, with prefix \`${prefix}\`.`);
								break;
							case '-cm': case '--create-message':
								if (!field)
									return message.channel.send(`No field information set for ${role.toString()}`);
								if (!field.classes.length)
									return message.channel.send('Field has no classes yet, message would be pointless!');

								// Create embed message
								return old_createReactMessage(message, field, args)
								.then(() => fieldDB.set(message.guild.id, manager)) // Update database
								.catch(console.error);
							case '-em': case '--edit-message':
								// Make sure there actually *is* a message to edit...
								if (!field.reactor.message)
									return message.channel.send('There is no message! Create one with --create-message.');

								editReactorText(message, field, args)
								.then(() => fieldDB.set(message.guild.id, manager)) // Update database
								.catch(console.error);

								return;
							case '-se': case '--set-emoji':
								if (!field)
									return message.channel.send(`No field information set for ${role.toString()}`);

								return old_setEmoji(message, field, args)
									.then(() => {
										// Update embed message
										old_editReactMessage(message, field);
										// Update database
										fieldDB.set(message.guild.id, manager);
									})
								.catch(console.error);
							case '-p': case '--print':
								if (!field)
									return message.channel.send(`No field information set for ${role.toString()}`);

								return message.channel.send(`${field.channel ? `category: ${message.guild.channels.resolve(field.channel).toString()}` : 'no category'}
${field.prefix ? `prefix: ${field.prefix}` : 'no prefix'}
React Role Message: ${field.reactor.channel && field.reactor.message ? message.guild.channels.resolve(field.reactor.channel).messages.resolve(field.reactor.message).url : 'no message'}
Classes: [ ${field.classes.map(field_class => field_class.name).join(', ')} ]
Roles: [ ${field.classes.map(field_class => field_class.role).map(id => message.guild.roles.resolve(id).toString()).join(', ')} ]
Channels: [ ${field.classes.map(field_class => field_class.channel).map(id => message.guild.channels.resolve(id).toString()).join(', ')} ]
Emoji: [ ${field.classes.map(field_class => field_class.emoji).join(', ')} ]`);
							case '-a': case '--add':
								if (!field)
									return message.channel.send(`No field information set for ${role.toString()}`);
								if (!field.channel)
									return message.channel.send(`${role.toString()} has no channel category defined, please use \`-sc\`.`);
								if (!field.prefix)
									return message.channel.send(`${role.toString()} has no prefix defined, please use \`-sp\`.`);

								return old_addClass(message, field, args)
								.then(() => fieldDB.set(message.guild.id, manager)) // Update database
								.catch(console.error);
							case '-c': case '--create':
								if (!field)
									return message.channel.send(`No field information set for ${role.toString()}`);
								if (!field.channel)
									return message.channel.send(`${role.toString()} has no channel category defined, please use \`-sc\`.`);
								if (!field.prefix)
									return message.channel.send(`${role.toString()} has no prefix defined, please use \`-sp\`.`);

								return old_createClass(message, field, args)
								.then(() => fieldDB.set(message.guild.id, manager)) // Update database
								.catch(console.error);
							case '-r': case '--remove':
								if (!field)
									return message.channel.send(`No field information set for ${role.toString()}`);
								if (!field.channel)
									return message.channel.send(`${role.toString()} has no channel category defined, please use \`-sc\`.`);
								if (!field.prefix)
									return message.channel.send(`${role.toString()} has no prefix defined, please use \`-sp\`.`);

								return old_removeClass(message, field, args)
								.then(() => fieldDB.set(message.guild.id, manager)) // Update database
								.catch(console.error);
							case '-d': case '--delete':
								if (!field)
									return message.channel.send(`No field information set for ${role.toString()}`);
								if (!field.channel)
									return message.channel.send(`${role.toString()} has no channel category defined, please use \`-sc\`.`);
								if (!field.prefix)
									return message.channel.send(`${role.toString()} has no prefix defined, please use \`-sp\`.`);

								return old_deleteClass(message, field, args)
								.then(() => fieldDB.set(message.guild.id, manager)) // Update database
								.catch(console.error);
							case '--purge':
								if (!field)
									return message.channel.send(`No field information set for ${role.toString()}`);

								// Cleanup react-role message if one exists.
								if (field.reactor.message)
									deleteMessage(message.guild, field.reactor); //.catch(message.channel.send('WARNING: There was an error deleting the previous message.'));

								// Update manager
								manager.fields.splice(manager.fields.indexOf(field), 1);

								message.channel.send(`${role.toString()} field no longer being managed.`);
								break;
							case '-s': case '--swap':
								if (!field)
									return message.channel.send(`No field information set for ${role.toString()}`);

								return old_swapRoles(message, field, args)
								.then(() => fieldDB.set(message.guild.id, manager))
								.catch(console.error);
							case '-mt': case '--move-top':
								if (!field)
									return message.channel.send(`No field information set for ${role.toString()}`);

								return old_moveTop(message, field, args)
								.then(() => fieldDB.set(message.guild.id, manager)) // Update database
								.catch(console.error);
							case '-mb': case '--move-bottom':
								if (!field)
									return message.channel.send(`No field information set for ${role.toString()}`);

								return old_moveBottom(message, field, args)
								.then(() => fieldDB.set(message.guild.id, manager)) // Update database
								.catch(console.error);
							case '-mu': case '--move-up':
								if (!field)
									return message.channel.send(`No field information set for ${role.toString()}`);

								return old_moveUp(message, field, args)
								.then(() => fieldDB.set(message.guild.id, manager)) // Update database
								.catch(console.error);
							case '-md': case '--move-down':
								if (!field)
									return message.channel.send(`No field information set for ${role.toString()}`);

								return old_moveDown(message, field, args)
								.then(() => fieldDB.set(message.guild.id, manager)) // Update database
								.catch(console.error);
						}
						fieldDB.set(message.guild.id, manager);
				}
			})
		.catch(console.error);
	},
	help(prefix) {
		return `
Full documentation too long for Discord message, please see GitLab wiki for more!

${prefix}catman (-l | --list)
${prefix}catman [role] (-se | --set-emoji) <field/class> <emoji>
${prefix}catman [role] (-cm | --create-message) <channel> (message)
${prefix}catman <role> (-sc | --set-category) <category_name>
${prefix}catman <role> (-sp | --set-prefix) <prefix>
${prefix}catman <role> --purge
${prefix}catman <role> (-a | -c | -r | -d) <class_number>
${prefix}catman <role> (-p | --print)

Without <role>
\t-l --list             Shows the fields currently stored in the manager (roles).
\t-se --set-emoji       Sets <field> to use <emoji> with role-react embed.
\t-cm --create-message  Creates a message in <channel> where users can click on
\t                      reactions to receive specific roles. Optional (message) to
\t                      display in the embed.
With <role>
\t-sc --set-category    Sets the Channel Category for this field to a category called
\t                      category_name (if one exists).
\t-sp --set-prefix      Sets the role/channel prefix for this field.
\t-se --set-emoji       Sets <class> to use <emoji> with role-react embed.
\t--purge               Deletes this field from the manager.
\t-a --add              Adds a role beginning with the field prefix, a space, and
\t                      class_number, and a channel beginning with field prefix, and
\t                      class_number.
\t-c --create           Creates a new role and channel, following the same convention
\t                      above.
\t-r --remove           Removes class_number from this field.
\t-d --delete           Removes class_number from this field, then deletes the role.
\t                      Channel must be deleted manually.
\t-p --print            Displays the information the manager has on this field.
`;
	},*/
}
