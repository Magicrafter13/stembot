const Discord = require('discord.js'); // Discord.js library - wrapper for Discord API

async function setEmoji(message, data, args) {
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

	// Update field/class
	sub_thing.emoji = emoji;

	return message.channel.send('Reaction emoji updated.');
}

async function addClass(message, field, args) {
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
	channel = message.guild.channels.cache.find(channel => channel.name.startsWith(`${field.prefix.toLowerCase()}${class_name}`) && channel.type === 'text')

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
		editReactMessage(message, field);

	return message.channel.send(`Adding ${class_role.toString()} and ${channel.toString()} to ${message.guild.roles.resolve(field.id).toString()} field.${emoji ? ` Emoji: ${emoji}.` : ''}`);
}

async function removeClass(message, field, args) {
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
		editReactMessage(message, field);

	return message.channel.send(`Removed \`${class_name}\` from list of classes.`);
}

async function createClass(message, field, args) {
	// Get class from user
	class_name = args.shift().toLowerCase();
	if (field.classes.find(field_class => field_class.name === class_name))
		return message.channel.send(`${role.toString()} already contains this class.`);

	// Get emoji from user, null if none specified
	emoji = args.length ? args.shift() : null;

	// Create class role
	const class_role = await message.guild.roles.create({
		data: {
			name: `${field.prefix} ${class_name}`,
			position: field.classes.length ? message.guild.roles.resolve(field.classes[field.classes.length - 1].role).position : null,
		},
		reason: `${message.author.username} added class ${class_name} to ${field.prefix}.`,
	});

	// Create class channel
	const class_channel = await message.guild.channels.create(`${field.prefix}${class_name}`, {
		type: 'text',
		parent: message.guild.channels.resolve(field.channel),
		reason: `${message.author.username} added class ${class_name} to ${field.prefix}.`,
	});

	// Move channel
	if (field.classes.length)
		class_channel.setPosition(message.guild.channels.resolve(field.classes[field.classes.length - 1].channel).rawPosition);

	// Add class to field
	field.classes.push({
		name: class_name,
		role: class_role.id,
		channel: class_channel.id,
		emoji: emoji,
	});

	// Update embed message
	if (field.reactor.message && emoji)
		editReactMessage(message, field);

	// Keep user informed
	return message.channel.send(`Adding ${class_role.toString()} and ${class_channel.toString()} to ${message.guild.roles.resolve(field.id).toString()} info.${emoji ? ` Emoji: ${emoji}.` : ''}`);
}

async function deleteClass(message, field, args) {
	// Get class from user, then from field
	class_name = args.shift().toLowerCase();
	old_class = field.classes.find(field_class => field_class.name === class_name);

	// Make sure class is valid
	if (!old_class)
		return message.channel.send(`${role.toString()} doesn't contain this class.`);

	// Remove class from field
	removeClass(message, field, [class_name]);

	// Delete role
	message.guild.roles.resolve(old_class.role).delete(`${message.author.username} deleted ${class_name} from ${field.prefix}.`)
	.then(message.channel.send('Role deleted.'))
	.catch(console.error);
	/*message.guild.channels.fetch(old_class.channel).delete(`${message.author.username} deleted ${class_name} from ${fieldData.prefix}.`)
	.then(message.channel.send('Channel deleted.'))
	.catch(console.error);*/
	// Delete channel (except not, because I'm still not sure I want the bot to have such power...)
	return message.channel.send(`You may now delete ${message.guild.channels.resolve(old_class.channel).toString()}.`);
}

async function createReactMessage(message, data, args) {
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
	editReactMessage(message, data).catch(console.error);
	
	return;
}

async function editReactorText(message, data, args) {
	// Get new string from user's command, and update message.
	data.reactor.text = args.join(' ');

	// Update embed message
	editReactMessage(message, data)
	.then(message.channel.send('Message text updated.'))
	.catch(console.error);

	return;
}

async function editReactMessage(message, data) {
	if (!data.reactor.message)
		return;

	// Check if 'data' is from 'manager' or 'field'
	const type = data.fields ? 'manager' : 'field';

	const things = type === 'manager'
		? data.fields.filter(field => field.emoji).map(field => `${field.emoji} - ${message.guild.channels.resolve(field.channel).name} Classes`).join('\n')
		: data.classes.filter(field_class => field_class.emoji).map(field_class => `${field_class.emoji} - ${data.prefix} ${field_class.name}`).join('\n');
		
	const embed = new Discord.MessageEmbed()
	.setColor(type === 'manager' ? '#cc8800' : '#0099ff')
	.setTitle(type === 'manager'
		? 'Roles for this server. (Fields)'
		: `Class Roles for ${message.guild.channels.resolve(data.channel).name}`)
	.setAuthor('Clark Stembot', 'https://www.clackamas.edu/images/default-source/logos/nwac/clark_college_300x300.png', 'https://gitlab.com/Magicrafter13/stembot')
	.setDescription(data.reactor.text)
	//.setThumbnail('link')
	.addFields({ name: type === 'manager' ? 'Fields' : 'Classes', value: things === '' ? 'None set (use --set-emoji).' : things })
	//.setImage('link')
	.setTimestamp()
	.setFooter('Report bugs on our GitLab repository.');

	const channel = message.guild.channels.resolve(data.reactor.channel)
	channel.messages.fetch(data.reactor.message)
		.then(msg => {
			msg.edit('', embed)
				.then(() => {
					(type === 'manager' ? data.fields : data.classes).forEach(t => {
						if (t.emoji)
							msg.react(t.emoji);
					});
				})
			.catch(console.error);
		})
	.catch(console.error);
	return;
}

async function deleteMessage(guild, reactor) {
	guild.channels.resolve(reactor.channel).messages.fetch(reactor.message)
	.then(m => m.delete({ reason: 'Old react-role message being deleted for new one.' }))
	.catch(console.error);
}

async function swapRoles(message, manager, args) {
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
	else return message.channel.send('Field\'s swapped.');
}

async function moveTop(message, manager, args) {
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
	else return message.channel.send('Field moved to top.');
}

async function moveBottom(message, manager, args) {
	if (args.length < 1)
		return message.channel.send('Syntax error, --move-top requires 1 argument.');

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
	else return message.channel.send('Field moved to bottom.');
}

async function moveUp(message, manager, args) {
	if (args.length < 1)
		return message.channel.send('Syntax error, --move-top requires 1 argument.');

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
	else return message.channel.send('Field moved up.');
}

async function moveDown(message, manager, args) {
	if (args.length < 1)
		return message.channel.send('Syntax error, --move-top requires 1 argument.');

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
	else return message.channel.send('Field moved down.');
}

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
	name: 'catman',
	description: 'Manage Class Subjects/Fields',
	guildOnly: true,
	cooldown: 0.5,
	argsMin: 1,
	argsMax: -1,
	execute(message, args, settings) {
		// Check if user has required permissions.
		const guildMember = message.guild.member(message.author);
		if (!guildMember.hasPermission('MANAGE_CHANNELS', { checkAdmin: true }) || !guildMember.hasPermission('MANAGE_ROLES', { checkAdmin: true }))
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
						setEmoji(message, manager, args)
							.then(() => {
								// Update embed message
								editReactMessage(message, manager)
								.then(() => fieldDB.set(message.guild.id, manager)) // Update database
								.catch(console.error);
							})
						.catch(console.error);

						break;
					case '-cm': case '--create-message':
						if (!manager.fields.length)
							return message.channel.send('There are no fields being managed yet, message would be pointless!');

						// Create embed message
						createReactMessage(message, manager, args)
						.then(() => fieldDB.set(message.guild.id, manager)) // Update database
						.catch (console.error);

						break;
					// Edit text of react-role message.
					case '-em': case '--edit-message':
						// Make sure there actually *is* a message to edit...
						if (!manager.reactor.message)
							return message.channel.send('There is no message! Create one with --create-message.');

						// Update reactor
						editReactorText(message, manager, args)
						.then(() => fieldDB.set(message.guild.id, manager)) // Update database
						.catch(console.error);

						break;
					// Swap 2 field's position in list
					case '-s': case '--swap':
						if (!manager.fields.length)
							return message.channel.send('There are no fields being managed yet. There isn\'t anything to swap?');

						swapRoles(message, manager, args)
						.then(() => fieldDB.set(message.guild.id, manager)) // Update database
						.catch(console.error);
						break;
					// Move field to top of list
					case '-mt': case '--move-top':
						if (!manager.fields.length)
							return message.channel.send('There are no fields being managed yet. There isn\'t anything to move?');

						moveTop(message, manager, args)
						.then(() => fieldDB.set(message.guild.id, manager)) // Update database
						.catch(console.error);
						break;
					// Move field to bottom of list
					case '-mb': case '--move-bottom':
						if (!manager.fields.length)
							return message.channel.send('There are no fields being managed yet. There isn\'t anything to move?');

						moveBottom(message, manager, args)
						.then(() => fieldDB.set(message.guild.id, manager)) // Update database
						.catch(console.error);
						break;
					// Move field up in list
					case '-mu': case '--move-up':
						if (!manager.fields.length)
							return message.channel.send('There are no fields being managed yet. There isn\'t anything to move?');

						moveUp(message, manager, args)
						.then(() => fieldDB.set(message.guild.id, manager)) // Update database
						.catch(console.error);
						break;
					// Move field down in list
					case '-md': case '--move-down':
						if (!manager.fields.length)
							return message.channel.send('There are no fields being managed yet. There isn\'t anything to move?');

						moveDown(message, manager, args)
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
						/*
						 / TODO for some reason, if this encounters an error (like the message not existing) the whole command stops.
						 / The bot will still respond to commands, it doesn't crash, but it's like it returns here?
						 / Temporary fix: add a -dm --delete-message command to be used in this situation
						 /
						 / Jan 1: But wait, that wouldn't change anything, since to run the --delete-message code, it would have to get
						 / past this point, which as stated before is where the issue happens...
						 / Ugh, just push it to release I don't even care right now
						 */
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
									return editReactMessage(message, field)
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
									return editReactMessage(message, field)
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
								return createReactMessage(message, field, args)
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

								return setEmoji(message, field, args)
									.then(() => {
										// Update embed message
										editReactMessage(message, field);
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

								return addClass(message, field, args)
								.then(() => fieldDB.set(message.guild.id, manager)) // Update database
								.catch(console.error);
							case '-c': case '--create':
								if (!field)
									return message.channel.send(`No field information set for ${role.toString()}`);
								if (!field.channel)
									return message.channel.send(`${role.toString()} has no channel category defined, please use \`-sc\`.`);
								if (!field.prefix)
									return message.channel.send(`${role.toString()} has no prefix defined, please use \`-sp\`.`);

								return createClass(message, field, args)
								.then(() => fieldDB.set(message.guild.id, manager)) // Update database
								.catch(console.error);
							case '-r': case '--remove':
								if (!field)
									return message.channel.send(`No field information set for ${role.toString()}`);
								if (!field.channel)
									return message.channel.send(`${role.toString()} has no channel category defined, please use \`-sc\`.`);
								if (!field.prefix)
									return message.channel.send(`${role.toString()} has no prefix defined, please use \`-sp\`.`);

								return removeClass(message, field, args)
								.then(() => fieldDB.set(message.guild.id, manager)) // Update database
								.catch(console.error);
							case '-d': case '--delete':
								if (!field)
									return message.channel.send(`No field information set for ${role.toString()}`);
								if (!field.channel)
									return message.channel.send(`${role.toString()} has no channel category defined, please use \`-sc\`.`);
								if (!field.prefix)
									return message.channel.send(`${role.toString()} has no prefix defined, please use \`-sp\`.`);

								return deleteClass(message, field, args)
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

								return swapRoles(message, field, args)
								.then(() => fieldDB.set(message.guild.id, manager))
								.catch(console.error);
							case '-mt': case '--move-top':
								if (!field)
									return message.channel.send(`No field information set for ${role.toString()}`);

								return moveTop(message, field, args)
								.then(() => fieldDB.set(message.guild.id, manager)) // Update database
								.catch(console.error);
							case '-mb': case '--move-bottom':
								if (!field)
									return message.channel.send(`No field information set for ${role.toString()}`);

								return moveBottom(message, field, args)
								.then(() => fieldDB.set(message.guild.id, manager)) // Update database
								.catch(console.error);
							case '-mu': case '--move-up':
								if (!field)
									return message.channel.send(`No field information set for ${role.toString()}`);

								return moveUp(message, field, args)
								.then(() => fieldDB.set(message.guild.id, manager)) // Update database
								.catch(console.error);
							case '-md': case '--move-down':
								if (!field)
									return message.channel.send(`No field information set for ${role.toString()}`);

								return moveDown(message, field, args)
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
	},
}
