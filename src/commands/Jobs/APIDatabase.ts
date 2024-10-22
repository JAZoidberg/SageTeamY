import { Collection, MongoClient } from 'mongodb';
import { DB } from '@root/config';
interface JobPreferences {
	userID: string;
	answers: {
		jobType: string;
		location: string;
		keywords: string[];
		experience: string;
		interests: string;
	};
	lastUpdated: Date;
}

export class JobPreferenceAPI {

	private collection: Collection;

	constructor(mongo: MongoClient) {
		this.collection = mongo.db().collection(DB.USERS);
	}
	async storeFormResponses(userID: string, answers: string[]): Promise<boolean> {
		try {
			const formattedAnswers = {
				jobType: answers[0],
				location: answers[1],
				keywords: answers[2].split(',').map(keyword => keyword.trim()),
				experience: answers[3],
				interests: answers[4]
			};
			await this.collection.updateOne(
				{ discordId: userID },
				{
					$set: {
						jobPreferences: {
							userID,
							answers: formattedAnswers,
							lastUpdated: new Date()
						}
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
	async getPreference(userID:string, answers: string[]): Promise<boolean> {
		return this.storeFormResponses(userID, answers);
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
