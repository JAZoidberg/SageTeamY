import { Collection, MongoClient } from 'mongodb';
import { DB } from '@root/config';

interface JobPreferences {
	userID: string;
	answers: {
		// First question set
		city: string;
		workType: string;
		employmentType: string;
		travelDistance: string;
		// Second question set
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

	constructor(mongo: MongoClient) {
		this.collection = mongo.db().collection(DB.USERS);
	}

	async storeFormResponses(userID: string, answers: string[], questionSet: number): Promise<boolean> {
		try {
			let updateObject = {};

			if (questionSet === 0) {
				updateObject = {
					'jobPreferences.answers.city': answers[0],
					'jobPreferences.answers.workType': answers[1],
					'jobPreferences.answers.employmentType': answers[2],
					'jobPreferences.answers.travelDistance': answers[3]
				};
			} else if (questionSet === 1) {
				updateObject = {
					'jobPreferences.answers.interest1': answers[0],
					'jobPreferences.answers.interest2': answers[1],
					'jobPreferences.answers.interest3': answers[2],
					'jobPreferences.answers.interest4': answers[3],
					'jobPreferences.answers.interest5': answers[4]
				};
			}

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
			return true;
		} catch (error) {
			console.error('Error storing job form responses', error);
			return false;
		}
	}

	async getPreference(userID: string, answers: string[], questionSet: number): Promise<boolean> {
		return this.storeFormResponses(userID, answers, questionSet);
	}

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
