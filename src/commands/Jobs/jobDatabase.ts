import { Collection, Db, MongoClient } from 'mongodb';
import { DB } from '@root/config';
import { Command } from '@root/src/lib/types/Command';
import { Emoji } from 'discord.js';

interface JobPreferences {
	userID: string;
	answers: {
		// Questions
		city: string;
		workType: string;
		employmentType: string;
		travelDistance: string;
		// Interests
		interest1: string;
		interest2: string;
		interest3: string;
		interest4: string;
		interest5: string;
	};
	lastUpdated: Date;
}


export class JobPreferenceAPI {

	private collection: Collection;
	mode: string;

	constructor(db: Db) {
		this.collection = db.collection(DB.USERS);
	}

	async storeFormResponses(userID: string, answers: string[], questionSet: number): Promise<boolean> {
		try {
			let updateObject = {};
			// const filterAnswers = answers.map(answer => answer.trim()).map((answer, index) => ({
			// 	index,
			// 	answer
			// })).filter(item => item.answer !== '');

			// Adds answers to questions.
			if (questionSet === 0) {
				// updateObject = {
				// 	'jobPreferences.answers.city': answers[0],
				// 	'jobPreferences.answers.workType': answers[1],
				// 	'jobPreferences.answers.employmentType': answers[2],
				// 	'jobPreferences.answers.travelDistance': answers[3]
				// };
				const [city, workType, employmentType, travelDistance] = answers;
				if (city?.trim()) updateObject['jobPreferences.answers.city'] = city;
				if (workType?.trim()) updateObject['jobPreferences.answers.workType'] = workType;
				if (employmentType?.trim()) updateObject['jobPreferences.answers.employmentType'] = employmentType;
				if (travelDistance?.trim()) updateObject['jobPreferences.answers.travelDistance'] = travelDistance;
			// Adds answers to interests.
			} else if (questionSet === 1) {
				// updateObject = {
				// 	'jobPreferences.answers.interest1': answers[0],
				// 	'jobPreferences.answers.interest2': answers[1],
				// 	'jobPreferences.answers.interest3': answers[2],
				// 	'jobPreferences.answers.interest4': answers[3],
				// 	'jobPreferences.answers.interest5': answers[4]
				// };
				const [interest1, interest2, interest3, interest4, interest5] = answers;
				if (interest1?.trim()) updateObject['jobPreferences.answers.interest1'] = interest1;
				if (interest2?.trim()) updateObject['jobPreferences.answers.interest2'] = interest2;
				if (interest3?.trim()) updateObject['jobPreferences.asnwers.interest3'] = interest3;
				if (interest4?.trim()) updateObject['jobPreferences.answers.interest4'] = interest4;
				if (interest5?.trim()) updateObject['jobPreferences.answers.interest5'] = interest5;
			}
			// Updates preferences with new answers and the new date inputted.
			if (Object.keys(updateObject).length > 0) {
				await this.collection.updateOne(
					{ discordId: userID },
					{
						$set: {
							...updateObject,
							'jobPreferences.userID': userID,
							'jobPreferences.lastUpdated': new Date()
						}
					},
					{ upsert: true }
				);
			}
			return true;
		} catch (error) {
			console.error('Error storing job form responses', error);
			return false;
		}
	}

	async getPreference(userID: string, answers: string[], questionSet: number): Promise<boolean> {
		return this.storeFormResponses(userID, answers, questionSet);
	}
	// Deletes the preferences answers to an empty string.
	async deletePreference(userID: string): Promise<boolean> {
		try {
			const result = await this.collection.updateOne(
				{ discordId: userID },
				{ $unset: { jobPreferences: '' } }
			);
			return result.modifiedCount > 0;
		} catch (error) {
			console.error('Error deleting job preference', error);
			return false;
		}
	}

}
