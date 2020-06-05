import { Paths } from 'eligibility/paths'

import { EligibilityPage } from 'eligibility/eligibilityPage'
import { YesNoOption } from 'models/yesNoOption'
import { EligibilityCheck, eligible, notEligible } from 'eligibility/model/eligibilityCheck'

class HelpWithFeesEligibilityPage extends EligibilityPage<YesNoOption> {
  constructor () {
    super(Paths.helpWithFeesPage, Paths.helpWithFeesReferencePage, 'helpWithFees')
  }

  checkEligibility (value: YesNoOption): EligibilityCheck {
    return value === YesNoOption.YES ? eligible() : notEligible(undefined, Paths.singleDefendantPage)
  }
}

/* tslint:disable:no-default-export */
export default new HelpWithFeesEligibilityPage().buildRouter()
