export interface JobForm {
	owner: string;
	questionSet: number;
	content: string;
	location: string;
	answers: string[];
	mode: 'public' | 'private';
}
