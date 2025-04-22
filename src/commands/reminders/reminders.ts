import { BOT, DB, GMAIL } from '@root/config';
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
import nodemailer from 'nodemailer';

// Emoji constants for button icons
const EMOJI = {
   REMINDER: '⏰',
   JOB: '💼',
   VIEW: '📋',
   CANCEL: '✖️',
   TIME: '🕒',
   REPEAT: '🔄',
   BACK: '↩️',
   EMAIL: '📧'  // Added email emoji
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
   extendedHelp = 'Create reminders for anything - one-time or recurring job alerts with optional email notifications.';
   options: ApplicationCommandOptionData[] = []; // No options needed as we're using buttons

   async run(
      interaction: ChatInputCommandInteraction
   ): Promise<InteractionResponse<boolean> | void> {
      await this.showMainMenu(interaction);
   }

   // Create and display the main menu
   private async showMainMenu(interaction: ChatInputCommandInteraction | any) {
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

      // Check if this is the initial interaction or a follow-up
      if (interaction instanceof ChatInputCommandInteraction) {
         // Initial command interaction
         const response = await interaction.reply({
            embeds: [embed],
            components: [row],
            ephemeral: true
         });

         // Create collector for button interactions
         this.createButtonCollector(response);
      } else {
         // A button interaction (going back to main menu)
         await interaction.update({
            embeds: [embed],
            components: [row]
         });
      }
   }

   // Create button collector for the main menu
   private createButtonCollector(response: any) {
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
         } else if (buttonInteraction.customId === 'back_to_menu') {
            // Handle going back to the main menu
            await this.showMainMenu(buttonInteraction);
         } else if (buttonInteraction.customId === 'email_yes') {
            // Handle yes for email notification
            await this.showEmailModal(buttonInteraction);
         } else if (buttonInteraction.customId === 'email_no') {
            // Handle no for email notification - retrieve the reminder data
            const reminderData = buttonInteraction.client.reminderTemp;
            if (reminderData) {
               await this.finalizeReminderCreation(buttonInteraction, false, null);
            } else {
               const errorEmbed = new EmbedBuilder()
                  .setColor(COLORS.DANGER)
                  .setTitle(`${EMOJI.CANCEL} Error Processing Reminder`)
                  .setDescription('Something went wrong while processing your reminder. Please try creating it again.')
                  .setTimestamp();
                  
               await buttonInteraction.update({
                  embeds: [errorEmbed],
                  components: [this.createBackButton()]
               });
            }
         } else if (buttonInteraction.customId === 'job_email_yes') {
            // Handle yes for job email notification
            await this.showJobEmailModal(buttonInteraction);
         } else if (buttonInteraction.customId === 'job_email_no') {
            // Handle no for job email notification - retrieve the job reminder data
            const jobReminderData = buttonInteraction.client.jobReminderTemp;
            if (jobReminderData) {
               await this.finalizeJobReminderCreation(buttonInteraction, false, null);
            } else {
               const errorEmbed = new EmbedBuilder()
                  .setColor(COLORS.DANGER)
                  .setTitle(`${EMOJI.CANCEL} Error Processing Job Reminder`)
                  .setDescription('Something went wrong while processing your job reminder. Please try creating it again.')
                  .setTimestamp();
                  
               await buttonInteraction.update({
                  embeds: [errorEmbed],
                  components: [this.createBackButton()]
               });
            }
         }
      });

      collector.on('end', async (collected) => {
         if (collected.size === 0) {
            const timeoutEmbed = new EmbedBuilder()
               .setColor(COLORS.DANGER)
               .setTitle(`${EMOJI.TIME} Reminder Action Timed Out`)
               .setDescription('You can run the command again to set up a reminder.')
               .setTimestamp();
               
            await response.interaction.editReply({
               embeds: [timeoutEmbed],
               components: []
            });
         }
      });
   }

   // Helper function to create a back button
   private createBackButton() {
      return new ActionRowBuilder<ButtonBuilder>()
         .addComponents(
            new ButtonBuilder()
               .setCustomId('back_to_menu')
               .setLabel('Back to Menu')
               .setEmoji(EMOJI.BACK)
               .setStyle(ButtonStyle.Secondary)
         );
   }

   // Handle creating a standard reminder via a modal
   private async handleCreateReminder(buttonInteraction: any) {
      // Store reference to original message
      const originalMessage = buttonInteraction.message;
      
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
            
            // Defer the modal reply to acknowledge it without sending a visible message
            await modalInteraction.deferUpdate();
            
            // Update the original message with the error
            await buttonInteraction.editReply({
               embeds: [errorEmbed],
               components: [this.createBackButton()], // Add back button
            });
            
            return;
         }

         // Calculate the expiry date
         const expiryDate = new Date(duration + Date.now());

         // Store the reminder data temporarily
         const reminderData = {
            content,
            expiryDate,
            buttonInteraction,
            modalInteraction
         };

         // Ask the user if they want email notifications
         await this.askForEmailNotification(reminderData);

      } catch (error) {
         console.error('Error in modal submission:', error);
         
         const errorEmbed = new EmbedBuilder()
            .setColor(COLORS.DANGER)
            .setTitle(`${EMOJI.CANCEL} Reminder Creation Failed`)
            .setDescription('The reminder creation process timed out or an error occurred.')
            .setTimestamp();
            
         // Update the original button interaction
         await buttonInteraction.editReply({
            embeds: [errorEmbed],
            components: [this.createBackButton()], // Add back button
         });
      }
   }

   // Ask if the user wants email notifications
   private async askForEmailNotification(reminderData: any) {
      const { buttonInteraction, modalInteraction } = reminderData;
      
      // Create embed asking about email notifications
      const emailEmbed = new EmbedBuilder()
         .setColor(COLORS.INFO)
         .setTitle(`${EMOJI.EMAIL} Would you like to receive this reminder by email too?`)
         .setDescription('Choose whether you want to also receive this reminder via email when it triggers.')
         .setFooter({ text: 'Email notifications are optional' })
         .setTimestamp();
      
      // Create Yes/No buttons
      const emailRow = new ActionRowBuilder<ButtonBuilder>()
         .addComponents(
            new ButtonBuilder()
               .setCustomId('email_yes')
               .setLabel('Yes, send email')
               .setEmoji(EMOJI.EMAIL)
               .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
               .setCustomId('email_no')
               .setLabel('No, Discord only')
               .setStyle(ButtonStyle.Secondary)
         );
      
      // Store the reminder data in the client's temporary collection
      // This way we can access it when the user makes a choice
      modalInteraction.client.reminderTemp = reminderData;
      
      // Defer the modal reply to acknowledge it
      await modalInteraction.deferUpdate();
      
      // Update original message to ask about email
      await buttonInteraction.editReply({
         embeds: [emailEmbed],
         components: [emailRow]
      });
   }

   // Show modal to collect email address
   private async showEmailModal(buttonInteraction: any) {
      // Create modal for email address
      const modal = new ModalBuilder()
         .setCustomId('email_modal')
         .setTitle(`${EMOJI.EMAIL} Email Notification`);

      // Add input for email address
      const emailInput = new TextInputBuilder()
         .setCustomId('email')
         .setLabel("Email address for notifications:")
         .setStyle(TextInputStyle.Short)
         .setPlaceholder("Enter your email address here...")
         .setRequired(true);

      // Create action row with input
      const emailRow = new ActionRowBuilder<TextInputBuilder>().addComponents(emailInput);

      // Add action row to the modal
      modal.addComponents(emailRow);

      // Show the modal
      await buttonInteraction.showModal(modal);

      try {
         // Wait for modal submission
         const modalInteraction = await buttonInteraction.awaitModalSubmit({
            time: 180000, // 3 minutes (extended)
            filter: (i: ModalSubmitInteraction) =>
               i.customId === 'email_modal' &&
               i.user.id === buttonInteraction.user.id
         });

         // Process modal submission
         const email = modalInteraction.fields.getTextInputValue('email');
         
         // Simple email validation
         const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
         if (!emailRegex.test(email)) {
            const errorEmbed = new EmbedBuilder()
               .setColor(COLORS.DANGER)
               .setTitle(`${EMOJI.CANCEL} Invalid Email Address`)
               .setDescription(`**"${email}"** does not appear to be a valid email address.`)
               .setFooter({ text: 'Please try again with a valid email address' });
            
            // Defer the modal reply to acknowledge it
            await modalInteraction.reply({ 
               embeds: [errorEmbed], 
               ephemeral: true 
            });
            return;
         }

         // Finalize the reminder creation with email
         await this.finalizeReminderCreation(buttonInteraction, true, email, modalInteraction);
      } catch (error) {
         console.error('Error in email modal submission:', error);
         
         // Only try to update if we haven't already replied
         try {
            const errorEmbed = new EmbedBuilder()
               .setColor(COLORS.DANGER)
               .setTitle(`${EMOJI.CANCEL} Email Collection Issue`)
               .setDescription('There was a problem processing your email. Your reminder has been created without email notifications.')
               .setTimestamp();
            
            // Update the original button interaction in a way that's safer
            await this.finalizeReminderCreation(buttonInteraction, false, null);
         } catch (updateError) {
            console.error('Error updating after email modal error:', updateError);
         }
      }
   }

   // Create and store the reminder with or without email
   private async finalizeReminderCreation(buttonInteraction: any, withEmail: boolean, email: string | null, modalInteraction?: ModalSubmitInteraction) {
      try {
         // Get the reminder data
         const reminderData = buttonInteraction.client.reminderTemp;
         
         // Check if we have valid reminder data
         if (!reminderData || !reminderData.content || !reminderData.expiryDate) {
            const errorEmbed = new EmbedBuilder()
               .setColor(COLORS.DANGER)
               .setTitle(`${EMOJI.CANCEL} Error Creating Reminder`)
               .setDescription('Missing reminder information. Please try creating your reminder again.')
               .setTimestamp();
               
            // If we have a modal interaction, respond to that
            if (modalInteraction && !modalInteraction.replied && !modalInteraction.deferred) {
               await modalInteraction.reply({
                  embeds: [errorEmbed],
                  ephemeral: true
               });
            } else {
               // Otherwise try to update the button interaction
               await buttonInteraction.update({
                  embeds: [errorEmbed],
                  components: [this.createBackButton()]
               });
            }
            return;
         }
         
         const { content, expiryDate } = reminderData;
         
         // Create the reminder object
         const reminder: Reminder = {
            owner: buttonInteraction.user.id,
            content,
            mode: 'public', // could be changed to private if needed
            expires: expiryDate,
            repeat: null, // No repeat by default
            emailNotification: withEmail,
            emailAddress: withEmail ? email : null
         };
   
         // Store the reminder in the database
         await buttonInteraction.client.mongo
            .collection(DB.REMINDERS)
            .insertOne(reminder);
   
         // Create success embed
         const successEmbed = new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle(`${EMOJI.REMINDER} Reminder Set!`)
            .setDescription(`I'll remind you about that at **${reminderTime(reminder)}**.`)
            .addFields({ 
               name: 'Reminder Content', 
               value: `> ${content}` 
            });
            
         // Add email info if applicable
         if (withEmail) {
            successEmbed.addFields({
               name: 'Email Notification',
               value: `You'll also receive an email at **${email}** when this reminder triggers.`
            });
         }
         
         successEmbed.setTimestamp();
         
         // Handle the response based on which interaction is available
         if (modalInteraction && !modalInteraction.replied && !modalInteraction.deferred) {
            // If we have a modal interaction that hasn't been replied to yet
            await modalInteraction.reply({
               content: "Your reminder has been created successfully!",
               ephemeral: true
            });
            
            // Update the original message
            await buttonInteraction.editReply({
               embeds: [successEmbed],
               components: [this.createBackButton()]
            });
         } else {
            // Otherwise try to update the button interaction
            // First check if we can update
            if (!buttonInteraction.replied) {
               await buttonInteraction.update({
                  embeds: [successEmbed],
                  components: [this.createBackButton()]
               });
            } else {
               // If we can't update, try to edit the reply
               await buttonInteraction.editReply({
                  embeds: [successEmbed],
                  components: [this.createBackButton()]
               });
            }
         }
         
         // Clean up temporary data
         delete buttonInteraction.client.reminderTemp;
      } catch (error) {
         console.error('Error in finalizeReminderCreation:', error);
         
         // Try to give feedback through any available channel
         const errorEmbed = new EmbedBuilder()
            .setColor(COLORS.WARNING)
            .setTitle(`${EMOJI.REMINDER} Reminder Process Completed`)
            .setDescription("Your reminder has been created, but there was an issue updating the display.")
            .setTimestamp();
            
         try {
            if (modalInteraction && !modalInteraction.replied && !modalInteraction.deferred) {
               await modalInteraction.reply({
                  embeds: [errorEmbed],
                  ephemeral: true
               });
            } else if (!buttonInteraction.replied) {
               await buttonInteraction.update({
                  embeds: [errorEmbed],
                  components: [this.createBackButton()]
               });
            }
         } catch (secondError) {
            console.error('Even the error handler failed:', secondError);
         }
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
            
         return buttonInteraction.update({
            embeds: [errorEmbed],
            components: [this.createBackButton()], // Add back button
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
               
            // Defer the modal reply to acknowledge it without sending a visible message
            await modalInteraction.deferUpdate();
            
            // Update the original message with the error
            await buttonInteraction.editReply({
               embeds: [errorEmbed],
               components: [this.createBackButton()], // Add back button
            });
            
            return;
         }
         
         // Validate filter input
         const validFilters = ['default', 'relevance', 'salary', 'date'];
         if (!validFilters.includes(filterValue)) {
            filterValue = 'default'; // Fallback to default if invalid
         }
         
         // Store job reminder data
         const jobReminderData = {
            repeatValue,
            filterValue,
            buttonInteraction,
            modalInteraction
         };
         
         // Ask about email notifications
         await this.askForJobEmailNotification(jobReminderData);

      } catch (error) {
         console.error('Error in modal submission:', error);
         const errorEmbed = new EmbedBuilder()
            .setColor(COLORS.DANGER)
            .setTitle(`${EMOJI.CANCEL} Job Alert Creation Failed`)
            .setDescription('The job alert creation process timed out or an error occurred.')
            .setTimestamp();
            
         // Update the original button interaction instead of creating a new message
         await buttonInteraction.editReply({
            embeds: [errorEmbed],
            components: [this.createBackButton()], // Add back button
         });
      }
   }

   // Ask if the user wants email notifications for job reminders
   private async askForJobEmailNotification(jobReminderData: any) {
      const { buttonInteraction, modalInteraction } = jobReminderData;
      
      // Create embed asking about email notifications
      const emailEmbed = new EmbedBuilder()
         .setColor(COLORS.INFO)
         .setTitle(`${EMOJI.EMAIL} Would you like to receive job alerts by email too?`)
         .setDescription('Choose whether you want to also receive job alerts via email when they trigger.')
         .setFooter({ text: 'Email notifications are optional' })
         .setTimestamp();
      
      // Create Yes/No buttons
      const emailRow = new ActionRowBuilder<ButtonBuilder>()
         .addComponents(
            new ButtonBuilder()
               .setCustomId('job_email_yes')
               .setLabel('Yes, send email')
               .setEmoji(EMOJI.EMAIL)
               .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
               .setCustomId('job_email_no')
               .setLabel('No, Discord only')
               .setStyle(ButtonStyle.Secondary)
         );
      
      // Store the job reminder data in the client's temporary collection
      modalInteraction.client.jobReminderTemp = jobReminderData;
      
      // Defer the modal reply to acknowledge it
      await modalInteraction.deferUpdate();
      
      // Update original message to ask about email
      await buttonInteraction.editReply({
         embeds: [emailEmbed],
         components: [emailRow]
      });
      
      // Create collector for the email choice buttons
      const collector = buttonInteraction.message.createMessageComponentCollector({
         componentType: ComponentType.Button,
         time: 60000, // 1 minute timeout
         filter: (i) => 
            (i.customId === 'job_email_yes' || i.customId === 'job_email_no') &&
            i.user.id === buttonInteraction.user.id
      });
      
      // Handle button collection
      collector.on('collect', async (i) => {
         // Clear the collector
         collector.stop();
         
         if (i.customId === 'job_email_yes') {
            // Show email modal for job reminders
            await this.showJobEmailModal(buttonInteraction);
         } else {
            // Finalize job reminder without email
            await this.finalizeJobReminderCreation(buttonInteraction, false, null);
         }
      });
      
      collector.on('end', (collected) => {
         if (collected.size === 0) {
            // Timeout - just create the reminder without email
            this.finalizeJobReminderCreation(buttonInteraction, false, null);
         }
      });
   }

   // Show modal to collect email address for job reminders
   private async showJobEmailModal(buttonInteraction: any) {
      // Create modal for email address
      const modal = new ModalBuilder()
         .setCustomId('job_email_modal')
         .setTitle(`${EMOJI.EMAIL} Email Notification for Job Alerts`);

      // Add input for email address
      const emailInput = new TextInputBuilder()
         .setCustomId('email')
         .setLabel("Email address for job alerts:")
         .setStyle(TextInputStyle.Short)
         .setPlaceholder("Enter your email address here...")
         .setRequired(true);

      // Create action row with input
      const emailRow = new ActionRowBuilder<TextInputBuilder>().addComponents(emailInput);

      // Add action row to the modal
      modal.addComponents(emailRow);

      // Show the modal
      await buttonInteraction.showModal(modal);

      try {
         // Wait for modal submission
         const modalInteraction = await buttonInteraction.awaitModalSubmit({
            time: 180000, // 3 minutes (extended)
            filter: (i: ModalSubmitInteraction) =>
               i.customId === 'job_email_modal' &&
               i.user.id === buttonInteraction.user.id
         });

         // Process modal submission
         const email = modalInteraction.fields.getTextInputValue('email');
         
         // Simple email validation
         const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
         if (!emailRegex.test(email)) {
            const errorEmbed = new EmbedBuilder()
               .setColor(COLORS.DANGER)
               .setTitle(`${EMOJI.CANCEL} Invalid Email Address`)
               .setDescription(`**"${email}"** does not appear to be a valid email address.`)
               .setFooter({ text: 'Please try again with a valid email address' });
            
            // Reply to the modal
            await modalInteraction.reply({ 
               embeds: [errorEmbed], 
               ephemeral: true 
            });
            return;
         }

         // Finalize the job reminder creation with email
         await this.finalizeJobReminderCreation(buttonInteraction, true, email, modalInteraction);
      } catch (error) {
         console.error('Error in job email modal submission:', error);
         
         try {
            // Create a reminder without email as a fallback
            await this.finalizeJobReminderCreation(buttonInteraction, false, null);
         } catch (fallbackError) {
            console.error('Failed even with fallback approach:', fallbackError);
         }
      }
   }

   // Create and store the job reminder with or without email
   private async finalizeJobReminderCreation(buttonInteraction: any, withEmail: boolean, email: string | null, modalInteraction?: ModalSubmitInteraction) {
      try {
         // Get the job reminder data
         const jobReminderData = buttonInteraction.client.jobReminderTemp;
         
         // Check if we have valid job reminder data
         if (!jobReminderData || !jobReminderData.repeatValue || !jobReminderData.filterValue) {
            const errorEmbed = new EmbedBuilder()
               .setColor(COLORS.DANGER)
               .setTitle(`${EMOJI.CANCEL} Error Creating Job Alert`)
               .setDescription('Missing job alert information. Please try creating your job alert again.')
               .setTimestamp();
               
            // If we have a modal interaction, respond to that
            if (modalInteraction && !modalInteraction.replied && !modalInteraction.deferred) {
               await modalInteraction.reply({
                  embeds: [errorEmbed],
                  ephemeral: true
               });
            } else {
               // Otherwise try to update the button interaction
               try {
                  await buttonInteraction.update({
                     embeds: [errorEmbed],
                     components: [this.createBackButton()]
                  });
               } catch (updateError) {
                  // If updating fails, try editing
                  await buttonInteraction.editReply({
                     embeds: [errorEmbed],
                     components: [this.createBackButton()]
                  });
               }
            }
            return;
         }
         
         const { repeatValue, filterValue } = jobReminderData;
         
         // Create the job reminder object
         const jobReminder: Reminder = {
            owner: buttonInteraction.user.id,
            content: 'Job Reminder',
            mode: 'private',
            expires: new Date(), // Set to now, will be handled by the job scheduler
            repeat: repeatValue as 'daily' | 'weekly',
            filterBy: filterValue as 'default' | 'relevance' | 'salary' | 'date',
            emailNotification: withEmail,
            emailAddress: withEmail ? email : null
         };
   
         // Store the job reminder in the database
         await buttonInteraction.client.mongo
            .collection(DB.REMINDERS)
            .insertOne(jobReminder);
   
         // Create success embed
         const successEmbed = new EmbedBuilder()
            .setColor(COLORS.SECONDARY)
            .setTitle(`${EMOJI.JOB} Job Alert Created`)
            .setDescription(
               `I'll send you job opportunities **${repeatValue}** starting at **${reminderTime(jobReminder)}**.`
            )
            .addFields(
               { name: 'Frequency', value: `${repeatValue.charAt(0).toUpperCase() + repeatValue.slice(1)}`, inline: true },
               { name: 'Sorted By', value: `${filterValue.charAt(0).toUpperCase() + filterValue.slice(1)}`, inline: true }
            );
            
         // Add email info if applicable
         if (withEmail) {
            successEmbed.addFields({
               name: 'Email Notification',
               value: `You'll also receive job alerts at **${email}** when they trigger.`
            });
         }
         
         successEmbed.setFooter({ text: 'You can update your preferences anytime' })
                    .setTimestamp();
         
         // Handle the response based on which interaction is available
         if (modalInteraction && !modalInteraction.replied && !modalInteraction.deferred) {
            // If we have a modal interaction that hasn't been replied to yet
            await modalInteraction.reply({
               content: "Your job alert has been created successfully!",
               ephemeral: true
            });
            
            // Update the original message
            await buttonInteraction.editReply({
               embeds: [successEmbed],
               components: [this.createBackButton()]
            });
         } else {
            // Otherwise try to update the button interaction
            try {
               await buttonInteraction.update({
                  embeds: [successEmbed],
                  components: [this.createBackButton()]
               });
            } catch (updateError) {
               // If updating fails, try editing
               await buttonInteraction.editReply({
                  embeds: [successEmbed],
                  components: [this.createBackButton()]
               });
            }
         }
         
         // Clean up temporary data
         delete buttonInteraction.client.jobReminderTemp;
      } catch (error) {
         console.error('Error in finalizeJobReminderCreation:', error);
         
         // Try to give feedback through any available channel
         const errorEmbed = new EmbedBuilder()
            .setColor(COLORS.WARNING)
            .setTitle(`${EMOJI.JOB} Job Alert Process Completed`)
            .setDescription("Your job alert has been created, but there was an issue updating the display.")
            .setTimestamp();
            
         try {
            if (modalInteraction && !modalInteraction.replied && !modalInteraction.deferred) {
               await modalInteraction.reply({
                  embeds: [errorEmbed],
                  ephemeral: true
               });
            } else {
               await buttonInteraction.editReply({
                  embeds: [errorEmbed],
                  components: [this.createBackButton()]
               });
            }
         } catch (secondError) {
            console.error('Even the error handler failed:', secondError);
         }
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
            
         // Update instead of reply to replace the message
         return buttonInteraction.update({
            embeds: [noRemindersEmbed],
            components: [this.createBackButton()], // Add back button
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
         const emailIcon = reminder.emailNotification ? ` ${EMOJI.EMAIL}` : '';
         
         embeds[Math.floor(i / 10)].addFields({
            name: `${i + 1}. ${icon}${emailIcon} ${
               hidden
                  ? isJobReminder
                     ? 'Job Alert'
                     : 'Private Reminder'
                  : reminder.content
            }`,
            value: hidden
               ? `${EMOJI.REPEAT} **${reminder.repeat}** job reminder filtered by **${reminder.filterBy}**${
                  reminder.emailNotification ? `\n${EMOJI.EMAIL} Email notifications to: ${reminder.emailAddress}` : ''
               }`
               : `${EMOJI.TIME} Due: **${reminderTime(reminder)}**${
                  reminder.emailNotification ? `\n${EMOJI.EMAIL} Email notifications to: ${reminder.emailAddress}` : ''
               }`
         });
      });
      
      // Add back button to the response
      const backButton = this.createBackButton();
      
      // Update instead of reply to replace the message
      await buttonInteraction.update({ 
         embeds,
         components: [backButton], // Add back button
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
               
            // Defer the modal reply to acknowledge it without sending a visible message
            await modalInteraction.deferUpdate();
            
            // Update the original message with the error
            await buttonInteraction.editReply({
               embeds: [errorEmbed],
               components: [this.createBackButton()], // Add back button
            });
            
            return;
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
            
            // Defer the modal reply to acknowledge it without sending a visible message
            await modalInteraction.deferUpdate();
            
            // Update the original message with the error
            await buttonInteraction.editReply({
               embeds: [notFoundEmbed],
               components: [this.createBackButton()], // Add back button
            });
            
            return;
         }

         // Delete the reminder
         await modalInteraction.client.mongo
            .collection(DB.REMINDERS)
            .findOneAndDelete(reminder);

         const hidden = reminder.mode === 'private';
         const isJobReminder = reminder.content === 'Job Reminder';
         const emailInfo = reminder.emailNotification ? `\nEmail notifications to ${reminder.emailAddress} have been canceled.` : '';
         
         const successEmbed = new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle(`${EMOJI.CANCEL} Reminder Cancelled`)
            .setDescription(
               `Successfully cancelled reminder **#${reminderNum + 1}**: ${
                  hidden 
                     ? (isJobReminder ? 'Job Alert' : 'Private Reminder') 
                     : `"${reminder.content}"`
               }${emailInfo}`
            )
            .setTimestamp();
            
         // Defer the modal reply to acknowledge it without sending a visible message
         await modalInteraction.deferUpdate();
            
         // Update the original message with the success info
         await buttonInteraction.editReply({
            embeds: [successEmbed],
            components: [this.createBackButton()], // Add back button
         });

      } catch (error) {
         console.error('Error in modal submission:', error);
         
         const errorEmbed = new EmbedBuilder()
            .setColor(COLORS.DANGER)
            .setTitle(`${EMOJI.CANCEL} Cancellation Failed`)
            .setDescription('The reminder cancellation process timed out or an error occurred.')
            .setTimestamp();
            
         // Update the original button interaction
         await buttonInteraction.editReply({
            embeds: [errorEmbed],
            components: [this.createBackButton()], // Add back button
         });
      }
   }
}