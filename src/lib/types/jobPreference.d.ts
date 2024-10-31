export interface JobPreferences {
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
	mode: 'public' | 'private'
}
