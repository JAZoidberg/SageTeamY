interface ValidateResult {
	isValid: boolean;
	error: string[];
}

export const validatePreferences = (answers: string[], qset: number, isJobForm: boolean): ValidateResult => {
	const errors: string[] = [];
	if (qset === 0) {
		const [city, workType, employmentType, travelDistance] = answers;
		if (!city?.trim()) errors.push('Enter valid city');
		if (!workType?.trim()) {
			errors.push('Enter valid work type');
		} else {
			const validWorkTypes = ['remote', 'hybrid', 'in-person'];
		}
	}
};
