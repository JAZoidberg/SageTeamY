import { ApplicationCommandPermissions, ChatInputCommandInteraction, ApplicationCommandOptionData, ApplicationCommandOptionType, InteractionResponse, Message } from 'discord.js';
import { BOTMASTER_PERMS } from '@lib/permissions';
import { Command } from '@lib/types/Command';
import nodemailer from 'nodemailer';
import { GMAIL } from '@root/config'; // Import the Gmail config

export default class extends Command {
    description = 'Sends a test email from Gmail to verify email functionality.';
    permissions: ApplicationCommandPermissions[] = BOTMASTER_PERMS;

    options: ApplicationCommandOptionData[] = [
        {
            name: 'recipient',
            description: 'Email address to send the test email to',
            type: ApplicationCommandOptionType.String,
            required: true
        },
        {
            name: 'subject',
            description: 'Subject line of the test email',
            type: ApplicationCommandOptionType.String,
            required: false
        }
    ]

    async run(interaction: ChatInputCommandInteraction): Promise<InteractionResponse<boolean> | void | Message<boolean>> {
        // Immediately defer the reply to prevent the "Unknown interaction" error
        await interaction.deferReply({ ephemeral: true });
        
        const recipient = interaction.options.getString('recipient');
        const subject = interaction.options.getString('subject') || 'Test Email from Discord Bot';
        
        // Create Gmail transporter using credentials from config
        const mailer = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: GMAIL.USER,
                pass: GMAIL.APP_PASSWORD
            }
        });

        try {
            await mailer.sendMail({
                from: GMAIL.USER,
                to: recipient,
                subject: subject,
                html: `<!DOCTYPE html>
                <html>
                <body>
                    <h2>Discord Bot Test Email</h2>
                    <p>This is a test email sent by the Discord bot to verify email functionality.</p>
                    <p>Sent by: ${interaction.user.tag} (${interaction.user.id})</p>
                    <p>Time: ${new Date().toLocaleString()}</p>
                </body>
                </html>`
            });

            return interaction.editReply({ 
                content: `✅ Test email successfully sent to ${recipient}!` 
            });
        } catch (error) {
            console.error('Email sending error:', error);
            return interaction.editReply({ 
                content: `❌ Failed to send test email: ${error.message}` 
            });
        }
    }
}