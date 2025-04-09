import { BOT, DB } from '@root/config';
import {
   ApplicationCommandOptionData,
   ChatInputCommandInteraction,
   InteractionResponse,
   ActionRowBuilder,
   ButtonBuilder,
   ButtonStyle,
   ComponentType,
   ModalBuilder,
   TextInputBuilder,
   TextInputStyle,
   ModalSubmitInteraction,
   EmbedBuilder
} from 'discord.js';
import { Reminder } from '@lib/types/Reminder';
import parse from 'parse-duration';
import { checkJobReminder, reminderTime } from '@root/src/lib/utils/generalUtils';
import { Command } from '@lib/types/Command';

// Emoji constants for button icons
const EMOJI = {
   REMINDER: '⏰',
   JOB: '💼',
   VIEW: '📋',
   CANCEL: '✖️',
   TIME: '🕒',
   REPEAT: '🔄'
};

// Color constants for embeds (using Discord.js ColorResolvable)
const COLORS = {
   PRIMARY: 0x5865F2,    // Discord Blurple
   SUCCESS: 0x57F287,    // Green
   DANGER: 0xED4245,     // Red
   WARNING: 0xFEE75C,    // Yellow
   SECONDARY: 0x9BA4EC,  // Light Blurple
   INFO: 0x5CBEFE        // Light Blue
};

export default class extends Command {
   description = `Have ${BOT.NAME} give you a reminder.`;
   extendedHelp = 'Create reminders for anything - one-time or recurring job alerts.';
   options: ApplicationCommandOptionData[] = []; // No options needed as we're using buttons

   async run(
      interaction: ChatInputCommandInteraction
   ): Promise<InteractionResponse<boolean> | void> {
      // Create a stylish initial embed
      const embed = new EmbedBuilder()
         .setColor(COLORS.PRIMARY)
         .setTitle(`${EMOJI.REMINDER} Reminder System`)
         .setDescription('What would you like to do?')
         .setFooter({ 
            text: `Requested by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL() 
         })
         .setTimestamp();

      // Create buttons with emojis and clear labels
      const row = new ActionRowBuilder<ButtonBuilder>()
         .addComponents(
            new ButtonBuilder()
               .setCustomId('create_reminder')
               .setLabel('Create Reminder')
               .setEmoji(EMOJI.REMINDER)
               .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
               .setCustomId('create_job_reminder')
               .setLabel('Job Alert')
               .setEmoji(EMOJI.JOB)
               .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
               .setCustomId('view_reminders')
               .setLabel('View All')
               .setEmoji(EMOJI.VIEW)
               .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
               .setCustomId('cancel_reminder')
               .setLabel('Cancel')
               .setEmoji(EMOJI.CANCEL)
               .setStyle(ButtonStyle.Danger)
         );

      // Send the initial message with embed and buttons
      const response = await interaction.reply({
         embeds: [embed],
         components: [row],
         ephemeral: true
      });

      // Create collector for button interactions
      const collector = response.createMessageComponentCollector({
         componentType: ComponentType.Button,
         time: 120000 // 2 minute timeout (extended)
      });

      collector.on('collect', async (buttonInteraction) => {
         // Handle button clicks
         if (buttonInteraction.customId === 'create_reminder') {
            await this.handleCreateReminder(buttonInteraction);
         } else if (buttonInteraction.customId === 'create_job_reminder') {
            await this.handleCreateJobReminder(buttonInteraction);
         } else if (buttonInteraction.customId === 'view_reminders') {
            await this.handleViewReminders(buttonInteraction);
         } else if (buttonInteraction.customId === 'cancel_reminder') {
            await this.handleCancelReminder(buttonInteraction);
         }
      });

      collector.on('end', async (collected) => {
         if (collected.size === 0) {
            const timeoutEmbed = new EmbedBuilder()
               .setColor(COLORS.DANGER)
               .setTitle(`${EMOJI.TIME} Reminder Action Timed Out`)
               .setDescription('You can run the command again to set up a reminder.')
               .setTimestamp();
               
            await interaction.editReply({
               embeds: [timeoutEmbed],
               components: []
            });
         }
      });
   }

   // Handle creating a standard reminder via a modal
   private async handleCreateReminder(buttonInteraction: any) {
      // Create modal for reminder details
      const modal = new ModalBuilder()
         .setCustomId('reminder_modal')
         .setTitle(`${EMOJI.REMINDER} Create New Reminder`);

      // Add inputs for content and duration
      const contentInput = new TextInputBuilder()
         .setCustomId('content')
         .setLabel("What would you like to be reminded of?")
         .setStyle(TextInputStyle.Paragraph)
         .setPlaceholder("Enter your reminder message here...")
         .setRequired(true);

      const durationInput = new TextInputBuilder()
         .setCustomId('duration')
         .setLabel("When would you like to be reminded?")
         .setPlaceholder('e.g. 1 hour, 30 minutes, 2 days, tomorrow at 3pm')
         .setStyle(TextInputStyle.Short)
         .setRequired(true);

      // Create action rows with inputs
      const contentRow = new ActionRowBuilder<TextInputBuilder>().addComponents(contentInput);
      const durationRow = new ActionRowBuilder<TextInputBuilder>().addComponents(durationInput);

      // Add action rows to the modal
      modal.addComponents(contentRow, durationRow);

      // Show the modal
      await buttonInteraction.showModal(modal);

      // Wait for modal submission
      try {
         const modalInteraction = await buttonInteraction.awaitModalSubmit({
            time: 180000, // 3 minutes (extended)
            filter: (i: ModalSubmitInteraction) =>
               i.customId === 'reminder_modal' &&
               i.user.id === buttonInteraction.user.id
         });

         // Process modal submission
         const content = modalInteraction.fields.getTextInputValue('content');
         const rawDuration = modalInteraction.fields.getTextInputValue('duration');
         const duration = parse(rawDuration);

         if (!duration) {
            const errorEmbed = new EmbedBuilder()
               .setColor(COLORS.DANGER)
               .setTitle(`${EMOJI.TIME} Invalid Time Format`)
               .setDescription(`**"${rawDuration}"** is not a valid duration.\nYou can use words like hours, minutes, seconds, days, weeks, months, or years.`)
               .setFooter({ text: 'Try something like "3 hours" or "2 days"' });
               
            return modalInteraction.reply({
               embeds: [errorEmbed],
               ephemeral: true
            });
         }

         // Calculate the expiry date
         const expiryDate = new Date(duration + Date.now());

         // Create and store the reminder directly
         const reminder: Reminder = {
            owner: modalInteraction.user.id,
            content,
            mode: 'public', // could be changed to private if needed
            expires: expiryDate,
            repeat: null // No repeat by default
         };

         await modalInteraction.client.mongo
            .collection(DB.REMINDERS)
            .insertOne(reminder);

         const successEmbed = new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle(`${EMOJI.REMINDER} Reminder Set!`)
            .setDescription(`I'll remind you about that at **${reminderTime(reminder)}**.`)
            .addFields({ 
               name: 'Reminder Content', 
               value: `> ${content}` 
            })
            .setTimestamp();
            
         await modalInteraction.reply({
            embeds: [successEmbed],
            ephemeral: true
         });

      } catch (error) {
         console.error('Error in modal submission:', error);
         
         const errorEmbed = new EmbedBuilder()
            .setColor(COLORS.DANGER)
            .setTitle(`${EMOJI.CANCEL} Reminder Creation Failed`)
            .setDescription('The reminder creation process timed out or an error occurred.')
            .setTimestamp();
            
         await buttonInteraction.followUp({
            embeds: [errorEmbed],
            ephemeral: true
         });
      }
   }

   // Handle creating a job reminder using a modal
   private async handleCreateJobReminder(buttonInteraction: any) {
      // Check for existing job reminder
      if (await checkJobReminder(buttonInteraction)) {
         const errorEmbed = new EmbedBuilder()
            .setColor(COLORS.WARNING)
            .setTitle(`${EMOJI.JOB} Job Reminder Already Exists`)
            .setDescription(
               'You currently already have a job reminder set. To clear your existing job reminder, use the CANCEL button and provide the reminder number.'
            );
            
         return buttonInteraction.reply({
            embeds: [errorEmbed],
            ephemeral: true
         });
      }

      // Create modal for job reminder settings
      const modal = new ModalBuilder()
         .setCustomId('job_reminder_modal')
         .setTitle(`${EMOJI.JOB} Create Job Alert`);

      // Add inputs for repeat frequency and filter type
      const repeatInput = new TextInputBuilder()
         .setCustomId('repeat')
         .setLabel('How often would you like to receive alerts?')
         .setPlaceholder('Type "daily", "weekly", or "monthly"')
         .setStyle(TextInputStyle.Short)
         .setRequired(true);

      const filterInput = new TextInputBuilder()
         .setCustomId('filter')
         .setLabel('Sort jobs by?')
         .setPlaceholder('default, relevance, salary, or date')
         .setStyle(TextInputStyle.Short)
         .setRequired(true)
         .setValue('default'); // Default value

      // Create action rows with inputs
      const repeatRow = new ActionRowBuilder<TextInputBuilder>().addComponents(repeatInput);
      const filterRow = new ActionRowBuilder<TextInputBuilder>().addComponents(filterInput);

      // Add action rows to the modal
      modal.addComponents(repeatRow, filterRow);

      // Show the modal
      await buttonInteraction.showModal(modal);

      // Wait for modal submission
      try {
         const modalInteraction = await buttonInteraction.awaitModalSubmit({
            time: 180000, // 3 minutes (extended)
            filter: (i: ModalSubmitInteraction) =>
               i.customId === 'job_reminder_modal' &&
               i.user.id === buttonInteraction.user.id
         });

         // Process modal submission
         let repeatValue = modalInteraction.fields.getTextInputValue('repeat').toLowerCase();
         let filterValue = modalInteraction.fields.getTextInputValue('filter').toLowerCase();
         
         // Validate repeat input
         if (repeatValue !== 'daily' && repeatValue !== 'weekly' && repeatValue !== 'monthly') {
            const errorEmbed = new EmbedBuilder()
               .setColor(COLORS.DANGER)
               .setTitle(`${EMOJI.REPEAT} Invalid Repeat Option`)
               .setDescription(`**"${repeatValue}"** is not a valid repeat option. Please use "daily", "weekly", or "monthly".`);
               
            return modalInteraction.reply({
               embeds: [errorEmbed],
               ephemeral: true
            });
         }
         
         // Validate filter input
         const validFilters = ['default', 'relevance', 'salary', 'date'];
         if (!validFilters.includes(filterValue)) {
            filterValue = 'default'; // Fallback to default if invalid
         }
         
         // Create and store the job reminder
         const jobReminder: Reminder = {
            owner: modalInteraction.user.id,
            content: 'Job Reminder',
            mode: 'private',
            expires: new Date(), // Set to now, will be handled by the job scheduler
            repeat: repeatValue as 'daily' | 'weekly',
            filterBy: filterValue as 'default' | 'relevance' | 'salary' | 'date'
         };

         await modalInteraction.client.mongo
            .collection(DB.REMINDERS)
            .insertOne(jobReminder);

         const successEmbed = new EmbedBuilder()
            .setColor(COLORS.SECONDARY)
            .setTitle(`${EMOJI.JOB} Job Alert Created`)
            .setDescription(
               `I'll send you job opportunities **${repeatValue}** starting at **${reminderTime(jobReminder)}**.`
            )
            .addFields(
               { name: 'Frequency', value: `${repeatValue.charAt(0).toUpperCase() + repeatValue.slice(1)}`, inline: true },
               { name: 'Sorted By', value: `${filterValue.charAt(0).toUpperCase() + filterValue.slice(1)}`, inline: true }
            )
            .setFooter({ text: 'You can update your preferences anytime' })
            .setTimestamp();
            
         await modalInteraction.reply({
            embeds: [successEmbed],
            ephemeral: true
         });

      } catch (error) {
         console.error('Error in modal submission:', error);
         const errorEmbed = new EmbedBuilder()
            .setColor(COLORS.DANGER)
            .setTitle(`${EMOJI.CANCEL} Job Alert Creation Failed`)
            .setDescription('The job alert creation process timed out or an error occurred.')
            .setTimestamp();
            
         await buttonInteraction.followUp({
            embeds: [errorEmbed],
            ephemeral: true
         });
      }
   }

   // Handle viewing reminders
   private async handleViewReminders(buttonInteraction: any) {
      const reminders: Array<Reminder> = await buttonInteraction.client.mongo
         .collection(DB.REMINDERS)
         .find({ owner: buttonInteraction.user.id })
         .toArray();
      
      reminders.sort((a, b) => a.expires.valueOf() - b.expires.valueOf());
      
      if (reminders.length < 1) {
         const noRemindersEmbed = new EmbedBuilder()
            .setColor(COLORS.INFO)
            .setTitle(`${EMOJI.VIEW} No Reminders Found`)
            .setDescription('You don\'t have any pending reminders!')
            .setFooter({ text: 'Use the CREATE REMINDER button to set one up' })
            .setTimestamp();
            
         return buttonInteraction.reply({
            embeds: [noRemindersEmbed],
            ephemeral: true
         });
      }
      
      const embeds: Array<EmbedBuilder> = [];
      reminders.forEach((reminder, i) => {
         if (i % 10 === 0) { // Reduced to 10 reminders per embed for better readability
            embeds.push(
               new EmbedBuilder()
                  .setTitle(`${EMOJI.VIEW} Your Reminders (${reminders.length})`)
                  .setColor(COLORS.INFO)
                  .setDescription('Here are all your pending reminders:')
                  .setFooter({ 
                     text: `Page ${Math.floor(i / 10) + 1}/${Math.ceil(reminders.length / 10)}` 
                  })
                  .setTimestamp()
            );
         }
         
         const hidden = reminder.mode === 'private';
         const isJobReminder = reminder.content === 'Job Reminder';
         const icon = isJobReminder ? EMOJI.JOB : EMOJI.REMINDER;
         
         embeds[Math.floor(i / 10)].addFields({
            name: `${i + 1}. ${icon} ${
               hidden
                  ? isJobReminder
                     ? 'Job Alert'
                     : 'Private Reminder'
                  : reminder.content
            }`,
            value: hidden
               ? `${EMOJI.REPEAT} **${reminder.repeat}** job reminder filtered by **${reminder.filterBy}**`
               : `${EMOJI.TIME} Due: **${reminderTime(reminder)}**`
         });
      });
      
      await buttonInteraction.reply({ 
         embeds,
         ephemeral: true 
      });
   }

   // Handle canceling a reminder
   private async handleCancelReminder(buttonInteraction: any) {
      // Create modal for reminder cancellation
      const modal = new ModalBuilder()
         .setCustomId('cancel_reminder_modal')
         .setTitle(`${EMOJI.CANCEL} Cancel Reminder`);

      // Add input for reminder number
      const reminderNumInput = new TextInputBuilder()
         .setCustomId('reminder_number')
         .setLabel("Which reminder would you like to cancel?")
         .setPlaceholder('Enter the number (e.g. 1, 2, 3)')
         .setStyle(TextInputStyle.Short)
         .setRequired(true);

      // Create action row with input
      const reminderNumRow = new ActionRowBuilder<TextInputBuilder>().addComponents(reminderNumInput);

      // Add action row to the modal
      modal.addComponents(reminderNumRow);

      // Show the modal
      await buttonInteraction.showModal(modal);

      // Wait for modal submission
      try {
         const modalInteraction = await buttonInteraction.awaitModalSubmit({
            time: 60000, // 1 minute
            filter: (i: ModalSubmitInteraction) =>
               i.customId === 'cancel_reminder_modal' &&
               i.user.id === buttonInteraction.user.id
         });

         // Process modal submission
         const reminderNumStr = modalInteraction.fields.getTextInputValue('reminder_number');
         const reminderNum = parseInt(reminderNumStr) - 1; // Convert to 0-based index
         
         if (isNaN(reminderNum) || reminderNum < 0) {
            const errorEmbed = new EmbedBuilder()
               .setColor(COLORS.DANGER)
               .setTitle(`${EMOJI.CANCEL} Invalid Reminder Number`)
               .setDescription(`**"${reminderNumStr}"** is not a valid reminder number. Please enter a positive integer.`)
               .setFooter({ text: 'Use the VIEW REMINDERS button to see your reminders and their numbers' });
               
            return modalInteraction.reply({
               embeds: [errorEmbed],
               ephemeral: true
            });
         }

         // Get user's reminders and sort them
         const reminders: Array<Reminder> = await modalInteraction.client.mongo
            .collection(DB.REMINDERS)
            .find({ owner: modalInteraction.user.id })
            .toArray();
         
         reminders.sort((a, b) => a.expires.valueOf() - b.expires.valueOf());
         
         // Check if the reminder exists
         const reminder = reminders[reminderNum];
         if (!reminder) {
            const notFoundEmbed = new EmbedBuilder()
               .setColor(COLORS.DANGER)
               .setTitle(`${EMOJI.CANCEL} Reminder Not Found`)
               .setDescription(`I couldn't find reminder **#${reminderNum + 1}**.`)
               .setFooter({ text: 'Use the VIEW REMINDERS button to see your current reminders' });
               
            return modalInteraction.reply({
               embeds: [notFoundEmbed],
               ephemeral: true
            });
         }

         // Delete the reminder
         await modalInteraction.client.mongo
            .collection(DB.REMINDERS)
            .findOneAndDelete(reminder);

         const hidden = reminder.mode === 'private';
         const isJobReminder = reminder.content === 'Job Reminder';
         
         const successEmbed = new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle(`${EMOJI.CANCEL} Reminder Cancelled`)
            .setDescription(
               `Successfully cancelled reminder **#${reminderNum + 1}**: ${
                  hidden 
                     ? (isJobReminder ? 'Job Alert' : 'Private Reminder') 
                     : `"${reminder.content}"`
               }`
            )
            .setTimestamp();
            
         return modalInteraction.reply({
            embeds: [successEmbed],
            ephemeral: true
         });

      } catch (error) {
         console.error('Error in modal submission:', error);
         
         const errorEmbed = new EmbedBuilder()
            .setColor(COLORS.DANGER)
            .setTitle(`${EMOJI.CANCEL} Cancellation Failed`)
            .setDescription('The reminder cancellation process timed out or an error occurred.')
            .setTimestamp();
            
         await buttonInteraction.followUp({
            embeds: [errorEmbed],
            ephemeral: true
         });
      }
   }
}