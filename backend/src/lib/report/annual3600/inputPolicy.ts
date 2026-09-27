/** Shared self/couple policy for the build-90 UI. Explicit legacy conventions win. */
export const ANNUAL_INPUT_POLICY_VERSION='annual-input-gender-explicit-2.0'
export interface AnnualInputFields {
 birthDate?:string;birthTime?:string;birthplace?:string;birthTimeZone?:string;
 gender?:string;spouseConvention?:string;annualYunConvention?:string;workContext?:string;
}
export function resolveAnnualInput(input:AnnualInputFields):AnnualInputFields {
 const gender=input.gender==='female'||input.gender==='male'?input.gender:undefined
 return {...input,
   spouseConvention:input.spouseConvention??(gender==='female'?'female_officer':gender==='male'?'male_wealth':undefined),
   annualYunConvention:input.annualYunConvention??gender,
   workContext:input.workContext,
 }
}
