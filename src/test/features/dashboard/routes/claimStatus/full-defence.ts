import { expect } from 'chai'
import * as request from 'supertest'
import * as config from 'config'

import { attachDefaultHooks } from 'test/routes/hooks'
import 'test/routes/expectations'

import { Paths } from 'dashboard/paths'

import { app } from 'main/app'

import * as idamServiceMock from 'test/http-mocks/idam'
import * as claimStoreServiceMock from 'test/http-mocks/claim-store'
import { checkAuthorizationGuards } from 'test/features/dashboard/routes/checks/authorization-check'
import { MomentFactory } from 'shared/momentFactory'
import { FreeMediationOption } from 'forms/models/freeMediation'
import { NumberFormatter } from 'utils/numberFormatter'

import {
  baseDefenceData,
  baseResponseData,
  defenceWithAmountClaimedAlreadyPaidData,
  defenceWithDisputeData
} from 'test/data/entity/responseData'

import {
  claimantRejectAlreadyPaid,
  directionsQuestionnaireDeadline,
  intentionToProceedDeadline,
  respondedAt,
  settledWithAgreement,
  settlementOffer,
  settlementOfferAccept,
  settlementOfferReject
} from 'test/data/entity/fullDefenceData'
import { MediationOutcome } from 'claims/models/mediationOutcome'
import { DefenceType } from 'claims/models/response/defenceType'
import { YesNoOption } from 'models/yesNoOption'
import { ProceedOfflineReason } from 'claims/models/proceedOfflineReason'
import { ResponseMethod } from 'claims/models/response/responseMethod'

const cookieName: string = config.get<string>('session.cookieName')

function fullDefenceClaim () {
  return {
    ...claimStoreServiceMock.sampleClaimObj,
    responseDeadline: MomentFactory.currentDate().add(1, 'days'),
    response: {
      ...baseResponseData,
      ...baseDefenceData,
      amount: 30
    },
    ...respondedAt()
  }
}

function testData () {
  return [
    {
      status: 'Full defence - defendant already paid',
      claim: fullDefenceClaim(),
      claimOverride: {
        response: { ...defenceWithAmountClaimedAlreadyPaidData }
      },
      claimantAssertions: [
        'The defendant’s response',
        `${fullDefenceClaim().claim.defendants[0].name} says they paid you ${NumberFormatter.formatMoney(defenceWithAmountClaimedAlreadyPaidData.paymentDeclaration.paidAmount)} on `,
        'You can accept or reject this response.',
        'View and respond'
      ],
      defendantAssertions: [
        'Your response to the claim',
        `We’ve emailed ${fullDefenceClaim().claim.claimants[0].name} telling them when and how you said you paid the claim.`,
        'Download your response'
      ]
    },
    {
      status: 'Full defence - defendant already paid - claimant does not proceed in time',
      claim: fullDefenceClaim(),
      claimOverride: {
        response: { ...defenceWithAmountClaimedAlreadyPaidData },
        ...intentionToProceedDeadline()
      },
      claimantAssertions: [
        'The court ended the claim',
        'This is because you didn’t proceed before the deadline of 4pm on',
        'You can contact us to apply for the claim to be restarted.',
        'Download the defendant’s full response'
      ],
      defendantAssertions: [
        'The court ended the claim',
        'This is because John Smith didn’t proceed with it before the deadline of 4pm on',
        'If they want to restart the claim, they need to ask for permission from the court. We’ll contact you by post if they do this.'
      ]
    },
    {
      status: 'Full defence - defendant already paid - claimant rejects defendant response with mediation',
      claim: fullDefenceClaim(),
      claimOverride: {
        response: {
          ...defenceWithAmountClaimedAlreadyPaidData,
          freeMediation: 'yes'
        },
        claimantResponse: {
          freeMediation: 'yes',
          settleForAmount: 'no',
          type: 'REJECTION'
        },
        claimantRespondedAt: MomentFactory.currentDate(),
        ...directionsQuestionnaireDeadline()
      },
      claimantAssertions: [
        'You’ve rejected the defendant’s response.',
        'We’ll contact you to try to arrange a mediation appointment',
        'You’ve both agreed to try mediation. We’ll contact you to try to arrange a call with the mediator.',
        'Find out how mediation works'
      ],
      defendantAssertions: [
        'John Smith has rejected your defence.',
        'We’ll contact you to try to arrange a mediation appointment',
        'You’ve both agreed to try mediation. We’ll contact you to try to arrange a call with the mediator.',
        'Find out how mediation works'
      ]
    },
    {
      status: 'Full defence - defendant already paid - claimant rejects defendant response with mediation - mediation failed',
      claim: fullDefenceClaim(),
      claimOverride: {
        features: ['directionsQuestionnaire'],
        response: {
          ...defenceWithAmountClaimedAlreadyPaidData,
          freeMediation: 'yes',
          directionsQuestionnaire: {
            hearingLoop: 'NO',
            selfWitness: 'NO',
            disabledAccess: 'NO',
            hearingLocation: 'Central London County Court',
            hearingLocationOption: 'SUGGESTED_COURT'
          }
        },
        claimantResponse: {
          freeMediation: 'yes',
          settleForAmount: 'no',
          type: 'REJECTION'
        },
        claimantRespondedAt: MomentFactory.currentDate(),
        mediationOutcome: MediationOutcome.FAILED
      },
      claimantAssertions: [
        'Mediation was unsuccessful',
        'You weren’t able to resolve your claim against ' + fullDefenceClaim().claim.defendants[0].name + ' using mediation.'
      ],
      defendantAssertions: [
        'Mediation was unsuccessful',
        'You weren’t able to resolve ' + fullDefenceClaim().claim.claimants[0].name + '’s claim against you using mediation.',
        'Download ' + fullDefenceClaim().claim.claimants[0].name + '’s hearing requirements'
      ]
    },
    {
      status: 'Full defence - defendant already paid - claimant rejects defendant response with mediation - mediation succeeded',
      claim: fullDefenceClaim(),
      claimOverride: {
        response: {
          ...defenceWithDisputeData,
          freeMediation: 'yes'
        },
        claimantResponse: {
          freeMediation: 'yes',
          settleForAmount: 'no',
          type: 'REJECTION'
        },
        claimantRespondedAt: MomentFactory.currentDate(),
        ...directionsQuestionnaireDeadline(),
        mediationOutcome: MediationOutcome.SUCCEEDED
      },
      claimantAssertions: [
        'You settled the claim through mediation',
        'You made an agreement which means the claim is now ended and sets out the terms of how ' + fullDefenceClaim().claim.defendants[0].name + ' must repay you.',
        'Download the agreement',
        '(PDF)'
      ],
      defendantAssertions: [
        'You settled the claim through mediation',
        'You made an agreement which means the claim is now ended and sets out the terms of how you must repay ' + fullDefenceClaim().claim.claimants[0].name + '.',
        'Download the agreement',
        '(PDF)',
        'Contact ' + fullDefenceClaim().claim.claimants[0].name,
        'if you need their payment details. Make sure you get receipts for any payments.'
      ]
    },
    {
      status: 'Full defence - defendant already paid - claimant rejects defendant response without mediation',
      claim: fullDefenceClaim(),
      claimOverride: {
        response: { ...defenceWithAmountClaimedAlreadyPaidData },
        ...claimantRejectAlreadyPaid(),
        ...directionsQuestionnaireDeadline()
      },
      claimantAssertions: [
        'Wait for the court to review the case',
        `You’ve rejected ${fullDefenceClaim().claim.defendants[0].name}’s response and said you want to take the case to court.`,
        'The court will review the case. We’ll email you if we set a hearing date to tell you how to prepare.',
        'Download their response'
      ],
      defendantAssertions: [
        `John Smith has rejected your admission of ${NumberFormatter.formatMoney(defenceWithAmountClaimedAlreadyPaidData.paymentDeclaration.paidAmount)}`,
        `They said you didn’t pay them £${defenceWithAmountClaimedAlreadyPaidData.paymentDeclaration.paidAmount}`,
        'You might have to go to a court hearing. We’ll contact you if we set a hearing date to tell you how to prepare.',
        'Download your response'
      ]
    },

    {
      status: 'Full defence - defendant disputes all of the claim - defendant offers settlement to settle out of court - claim settled with agreement',
      claim: fullDefenceClaim(),
      claimOverride: {
        response: {
          ...baseResponseData,
          ...baseDefenceData
        },
        ...directionsQuestionnaireDeadline(),
        ...settledWithAgreement()
      },
      claimantAssertions: [
        'Agreement signed',
        'You’ve both signed a legal agreement. The claim is now settled.',
        'Download the settlement agreement'
      ],
      defendantAssertions: [
        'Agreement signed',
        'You’ve both signed a legal agreement. The claim is now settled.',
        'Download the settlement agreement'
      ]
    },
    {
      status: 'Full defence - defendant disputes all of the claim and accepts mediation',
      claim: fullDefenceClaim(),
      claimOverride: {
        response: {
          ...baseResponseData,
          ...baseDefenceData,
          freeMediation: FreeMediationOption.YES
        },
        ...directionsQuestionnaireDeadline()
      },
      claimantAssertions: [
        'Decide whether to proceed',
        `${fullDefenceClaim().claim.defendants[0].name} has rejected your claim.`,
        'You need to decide whether to proceed with the claim.',
        'You need to respond before 4pm on ',
        'Your claim won’t continue if you don’t respond by then.',
        'View and respond',
        'Settle out of court',
        `${fullDefenceClaim().claim.defendants[0].name} has made an offer to settle out of court.`,
        'View and respond to the offer',
        'Tell us you’ve ended the claim',
        'If you’ve been paid or you’ve made another agreement with the defendant, you need to tell us.',
        'Tell us you’ve settled'
      ],
      defendantAssertions: [
        'Your response to the claim',
        'You have rejected the claim. You’ve suggested mediation.',
        'We’ll ask ' + fullDefenceClaim().claim.claimants[0].name + ' if they agree to take part in mediation.',
        'Download your response',
        'Settle out of court',
        'settle the claim out of court'
      ]
    },
    {
      status: 'Full defence - defendant disputes all of the claim and accepts mediation - defendant offers settlement to settle out of court',
      claim: fullDefenceClaim(),
      claimOverride: {
        response: {
          ...baseResponseData,
          ...baseDefenceData,
          freeMediation: FreeMediationOption.YES
        },
        ...directionsQuestionnaireDeadline(),
        ...settlementOffer()
      },
      claimantAssertions: [
        'Decide whether to proceed',
        `${fullDefenceClaim().claim.defendants[0].name} has rejected your claim`,
        'You need to decide whether to proceed with the claim. You need to respond before 4pm on',
        'Your claim won’t continue if you don’t respond by then.',
        'Settle out of court',
        `${fullDefenceClaim().claim.defendants[0].name} has made an offer to settle out of court.`,
        'View and respond to the offer',
        'Tell us you’ve ended the claim',
        'If you’ve been paid or you’ve made another agreement with the defendant, you need to tell us.',
        'Tell us you’ve settled'
      ],
      defendantAssertions: [
        'Your response to the claim',
        'You have rejected the claim. You’ve suggested mediation.',
        `We’ll ask ${fullDefenceClaim().claim.claimants[0].name} if they agree to take part in mediation.`,
        'Download your response',
        'Settle out of court',
        `You made an offer to settle the claim out of court. ${fullDefenceClaim().claim.claimants[0].name} can accept or reject your offer.`
      ]
    },
    {
      status: 'Full defence - defendant disputes all of the claim and accepts mediation - defendant offers settlement to settle out of court - claimant accepts offer',
      claim: fullDefenceClaim(),
      claimOverride: {
        response: {
          ...baseResponseData,
          ...baseDefenceData,
          freeMediation: FreeMediationOption.YES
        },
        ...directionsQuestionnaireDeadline(),
        ...settlementOfferAccept()
      },
      claimantAssertions: [
        'Decide whether to proceed',
        `${fullDefenceClaim().claim.defendants[0].name} has rejected your claim.`,
        'You need to decide whether to proceed with the claim.',
        'You need to respond before 4pm on ',
        'Your claim won’t continue if you don’t respond by then.',
        'View and respond',
        'Settle out of court',
        `You’ve agreed to the offer made by ${fullDefenceClaim().claim.defendants[0].name} and signed an agreement to settle your claim.`,
        `We’ve asked ${fullDefenceClaim().claim.defendants[0].name} to sign the agreement.`,
        'Tell us you’ve ended the claim',
        'If you’ve been paid or you’ve made another agreement with the defendant, you need to tell us.',
        'Tell us you’ve settled'
      ],
      defendantAssertions: [
        'Your response to the claim',
        'You have rejected the claim. You’ve suggested mediation.',
        'We’ll ask ' + fullDefenceClaim().claim.claimants[0].name + ' if they agree to take part in mediation.',
        'Download your response',
        'Settle out of court',
        'The claimant has accepted your offer and signed a legal agreement. You need to sign the agreement to settle out of court.',
        'Sign the settlement agreement'
      ]
    },
    {
      status: 'Full defence - defendant disputes all of the claim and accepts mediation - defendant offers settlement to settle out of court - claimant rejects offer',
      claim: fullDefenceClaim(),
      claimOverride: {
        response: {
          ...baseResponseData,
          ...baseDefenceData,
          freeMediation: FreeMediationOption.YES
        },
        ...directionsQuestionnaireDeadline(),
        ...settlementOfferReject()
      },
      claimantAssertions: [
        'Decide whether to proceed',
        `${fullDefenceClaim().claim.defendants[0].name} has rejected your claim.`,
        'You need to decide whether to proceed with the claim.',
        'You need to respond before 4pm on',
        'Your claim won’t continue if you don’t respond by then.',
        'View and respond',
        'Settle out of court',
        'You’ve rejected the defendant’s offer to settle out of court. You won’t receive any more offers from the defendant.',
        'Tell us you’ve ended the claim',
        'If you’ve been paid or you’ve made another agreement with the defendant, you need to tell us.',
        'Tell us you’ve settled'
      ],
      defendantAssertions: [
        'Your response to the claim',
        'You have rejected the claim. You’ve suggested mediation.',
        'We’ll ask ' + fullDefenceClaim().claim.claimants[0].name + ' if they agree to take part in mediation.',
        'Download your response',
        'Settle out of court',
        'The claimant has rejected your offer to settle the claim. Complete the directions questionnaire.'
      ]
    },
    {
      status: 'Full defence - defendant disputes all of the claim and accepts mediation with directions questionnaire enabled',
      claim: fullDefenceClaim(),
      claimOverride: {
        features: ['directionsQuestionnaire'],
        response: {
          ...baseResponseData,
          ...baseDefenceData,
          freeMediation: FreeMediationOption.YES
        }
      },
      claimantAssertions: [
        'Decide whether to proceed',
        fullDefenceClaim().claim.defendants[0].name + ' has rejected your claim.',
        'View and respond'
      ],
      defendantAssertions: [
        'Your response to the claim',
        'You have rejected the claim. You’ve suggested mediation.',
        'We’ll ask ' + fullDefenceClaim().claim.claimants[0].name + ' if they agree to take part in mediation.',
        'Download your response',
        'Settle out of court',
        'settle the claim out of court'
      ]
    },

    {
      status: 'Full defence - defendant disputes all of the claim and rejects mediation',
      claim: fullDefenceClaim(),
      claimOverride: {
        response: {
          ...baseResponseData,
          ...baseDefenceData
        },
        ...directionsQuestionnaireDeadline()
      },
      claimantAssertions: [
        'Decide whether to proceed',
        `${fullDefenceClaim().claim.defendants[0].name} has rejected your claim.`,
        'You need to decide whether to proceed with the claim.',
        'You need to respond before 4pm on ',
        'Your claim won’t continue if you don’t respond by then.',
        'View and respond',
        'Settle out of court',
        `${fullDefenceClaim().claim.defendants[0].name} has made an offer to settle out of court.`,
        'View and respond to the offer',
        'Tell us you’ve ended the claim',
        'If you’ve been paid or you’ve made another agreement with the defendant, you need to tell us.',
        'Tell us you’ve settled'
      ],
      defendantAssertions: [
        'Wait for the claimant to respond',
        'You’ve rejected the claim.',
        'You said you don’t want to use mediation to solve it. You might have to go to a hearing.',
        'We’ll contact you when the claimant responds.',
        'Settle out of court',
        `You made an offer to settle the claim out of court. ${fullDefenceClaim().claim.claimants[0].name} can accept or reject your offer.`,
        'We’ll email you when they respond.'
      ]
    },
    {
      status: 'Full defence - defendant disputes all of the claim and rejects mediation - claimant accepts full defence',
      claim: fullDefenceClaim(),
      claimOverride: {
        response: {
          ...defenceWithDisputeData,
          freeMediation: 'no'
        },
        claimantResponse: {
          type: 'ACCEPTATION'
        },
        claimantRespondedAt: MomentFactory.currentDate(),
        ...directionsQuestionnaireDeadline()
      },
      claimantAssertions: [
        'You stopped this claim',
        'You ended the claim on'
      ],
      defendantAssertions: [
        'This claim has ended',
        fullDefenceClaim().claim.claimants[0].name
        + ' ended their claim against you on'
      ]
    },
    {
      status: 'Full defence - defendant disputes all of the claim and rejects mediation - claimant does not do intention to proceed',
      claim: fullDefenceClaim(),
      claimOverride: {
        response: {
          ...defenceWithDisputeData
        },
        ...directionsQuestionnaireDeadline(),
        ...intentionToProceedDeadline()
      },
      claimantAssertions: [
        'The court ended the claim',
        'This is because you didn’t proceed before the deadline of 4pm on',
        'You can contact us to apply for the claim to be restarted.',
        'Download the defendant’s full response'
      ],
      defendantAssertions: [
        'The court ended the claim',
        'This is because John Smith didn’t proceed with it before the deadline of 4pm on',
        'If they want to restart the claim, they need to ask for permission from the court. We’ll contact you by post if they do this.'
      ]
    },
    {
      status: 'Full defence - defendant disputes all of the claim and rejects mediation - defendant offers settlement to settle out of court',
      claim: fullDefenceClaim(),
      claimOverride: {
        response: {
          ...baseResponseData,
          ...baseDefenceData
        },
        ...directionsQuestionnaireDeadline(),
        ...settlementOffer()
      },
      claimantAssertions: [
        'Decide whether to proceed',
        `${fullDefenceClaim().claim.defendants[0].name} has rejected your claim.`,
        'You need to decide whether to proceed with the claim.',
        'You need to respond before 4pm on ',
        'Your claim won’t continue if you don’t respond by then.',
        'View and respond',
        'Settle out of court',
        `${fullDefenceClaim().claim.defendants[0].name} has made an offer to settle out of court.`,
        'View and respond to the offer',
        'Tell us you’ve ended the claim',
        'If you’ve been paid or you’ve made another agreement with the defendant, you need to tell us.',
        'Tell us you’ve settled'
      ],
      defendantAssertions: [
        'Wait for the claimant to respond',
        'You’ve rejected the claim.',
        'You said you don’t want to use mediation to solve it. You might have to go to a hearing.',
        'We’ll contact you when the claimant responds.',
        'Settle out of court',
        `You made an offer to settle the claim out of court. ${fullDefenceClaim().claim.claimants[0].name} can accept or reject your offer.`,
        'We’ll email you when they respond.'
      ]
    },
    {
      status: 'Full defence - defendant disputes all of the claim and rejects mediation - defendant offers settlement to settle out of court - claimant accepts offer',
      claim: fullDefenceClaim(),
      claimOverride: {
        response: {
          ...baseResponseData,
          ...baseDefenceData
        },
        ...directionsQuestionnaireDeadline(),
        ...settlementOfferAccept()
      },
      claimantAssertions: [
        'Decide whether to proceed',
        `${fullDefenceClaim().claim.defendants[0].name} has rejected your claim.`,
        'You need to decide whether to proceed with the claim.',
        'You need to respond before 4pm on ',
        'Your claim won’t continue if you don’t respond by then.',
        'View and respond',
        'Settle out of court',
        `You’ve agreed to the offer made by ${fullDefenceClaim().claim.defendants[0].name} and signed an agreement to settle your claim.`,
        `We’ve asked ${fullDefenceClaim().claim.defendants[0].name} to sign the agreement.`,
        'Tell us you’ve ended the claim',
        'If you’ve been paid or you’ve made another agreement with the defendant, you need to tell us.',
        'Tell us you’ve settled'
      ],
      defendantAssertions: [
        'Wait for the claimant to respond',
        'You’ve rejected the claim.',
        'You said you don’t want to use mediation to solve it. You might have to go to a hearing.',
        'We’ll contact you when the claimant responds.',
        'Settle out of court',
        'The claimant has accepted your offer and signed a legal agreement. You need to sign the agreement to settle out of court.',
        'When you’ve both signed the agreement, the claim won’t proceed.',
        'Sign the settlement agreement'
      ]
    },
    {
      status: 'Full defence - defendant disputes all of the claim and rejects mediation - defendant offers settlement to settle out of court - claimant rejects offer',
      claim: fullDefenceClaim(),
      claimOverride: {
        response: {
          ...baseResponseData,
          ...baseDefenceData
        },
        ...directionsQuestionnaireDeadline(),
        ...settlementOfferReject()
      },
      claimantAssertions: [
        'Decide whether to proceed',
        `${fullDefenceClaim().claim.defendants[0].name} has rejected your claim.`,
        'You need to decide whether to proceed with the claim.',
        'You need to respond before 4pm on ',
        'Your claim won’t continue if you don’t respond by then.',
        'View and respond',
        'Settle out of court',
        'You’ve rejected the defendant’s offer to settle out of court. You won’t receive any more offers from the defendant.',
        'Tell us you’ve ended the claim',
        'If you’ve been paid or you’ve made another agreement with the defendant, you need to tell us.',
        'Tell us you’ve settled'
      ],
      defendantAssertions: [
        'Wait for the claimant to respond',
        'You’ve rejected the claim.',
        'You said you don’t want to use mediation to solve it. You might have to go to a hearing.',
        'We’ll contact you when the claimant responds.',
        'Settle out of court',
        'The claimant has rejected your offer to settle the claim. Complete the directions questionnaire.'
      ]
    },
    {
      status: 'Full defence - defendant disputes all of the claim and rejects mediation with directions questionnaire enabled',
      claim: fullDefenceClaim(),
      claimOverride: {
        ...directionsQuestionnaireDeadline(),
        features: ['directionsQuestionnaire'],
        response: {
          ...baseResponseData,
          ...baseDefenceData,
          freeMediation: FreeMediationOption.NO
        }
      },
      claimantAssertions: [
        'Decide whether to proceed',
        fullDefenceClaim().claim.defendants[0].name + ' has rejected your claim.',
        'View and respond'
      ],
      defendantAssertions: [
        'Wait for the claimant to respond',
        'You’ve rejected the claim.',
        'You said you don’t want to use mediation to solve it. You might have to go to a hearing.',
        'We’ll contact you when the claimant responds.',
        'Settle out of court',
        'settle the claim out of court'
      ]
    },
    {
      status: 'Full defence - defendant disputes the claim - claimant rejects defendant response with mediation - online DQ',
      claim: fullDefenceClaim(),
      claimOverride: {
        features: ['admission', 'directionsQuestionnaire'],
        response: {
          ...baseResponseData,
          ...baseDefenceData,
          freeMediation: FreeMediationOption.YES,
          defenceType: DefenceType.DISPUTE,
          directionsQuestionnaire: {
            hearingLoop: 'NO',
            selfWitness: 'NO',
            disabledAccess: 'NO',
            hearingLocation: 'Central London County Court',
            hearingLocationOption: 'SUGGESTED_COURT'
          }
        },
        claimantResponse: {
          freeMediation: 'yes',
          settleForAmount: 'no',
          type: 'REJECTION'
        },
        claimantRespondedAt: MomentFactory.currentDate()
      },
      claimantAssertions: [
        'You’ve both agreed to try mediation.',
        'We’ll contact you to try to arrange a call with the mediator.'
      ],
      defendantAssertions: [
        `${fullDefenceClaim().claim.claimants[0].name} has rejected your defence.`,
        'You’ve both agreed to try mediation. We’ll contact you to try to arrange a call with the mediator.',
        'Find out how mediation works',
        'They’ve also sent us their hearing requirements.',
        'Download their hearing requirements'
      ]
    },
    {
      status: 'Full defence - defendant disputes the claim - claimant rejects defendant response without mediation - online DQ',
      claim: fullDefenceClaim(),
      claimOverride: {
        features: ['admission', 'directionsQuestionnaire'],
        response: {
          ...baseResponseData,
          ...baseDefenceData,
          freeMediation: FreeMediationOption.NO,
          defenceType: DefenceType.DISPUTE,
          directionsQuestionnaire: {
            hearingLoop: 'NO',
            selfWitness: 'NO',
            disabledAccess: 'NO',
            hearingLocation: 'Central London County Court',
            hearingLocationOption: 'SUGGESTED_COURT'
          }
        },
        claimantResponse: {
          type: 'REJECTION',
          freeMediation: 'no',
          settleForAmount: 'no'
        },
        claimantRespondedAt: MomentFactory.currentDate()
      },
      claimantAssertions: [
        'You’ve rejected defendant’s response and said you want to take the case to court.',
        'The court will review the case. We’ll email you if we set a hearing date to tell you how to prepare.'
      ],
      defendantAssertions: [
        `${fullDefenceClaim().claim.claimants[0].name} has rejected your defence.`,
        'The court will review the case. We’ll email you if we set a hearing date to tell you how to prepare.',
        'They’ve also sent us their hearing requirements.',
        'Download their hearing requirements']
    },

    {
      status: 'Full defence - defendant sent a paper response',
      claim: fullDefenceClaim(),
      claimOverride: {
        response: {
          ...baseResponseData,
          ...baseDefenceData,
          freeMediation: FreeMediationOption.YES,
          responseMethod: ResponseMethod.OFFLINE
        },
        paperResponse: YesNoOption.YES.option
      },
      claimantAssertions: [
        'The claim will continue by post',
        'The defendant responded to your claim by post. This means you can no longer use this service to continue the claim - you’ll need to use paper forms instead.',
        'Your online account won’t be updated with the progress of this claim.',
        'We’ll post you a copy of the defendant’s response. This will explain what you need to do next.'
      ],
      defendantAssertions: [
        'The claim will continue by post',
        'Because you responded to the claim using a paper form, all further action in this claim will be by post.',
        'Your online account won’t be updated with the progress of this claim.',
        'If ' + fullDefenceClaim().claim.claimants[0].name + ' chooses to continue the claim we’ll post you a copy of their response. This will explain what you need to do next.'
      ]
    },
    {
      status: 'Full defence - claimant asked to proceed offline',
      claim: fullDefenceClaim(),
      claimOverride: {
        response: {
          ...baseResponseData,
          ...baseDefenceData,
          freeMediation: FreeMediationOption.YES
        },
        proceedOfflineReason: ProceedOfflineReason.APPLICATION_BY_CLAIMANT
      },
      claimantAssertions: [
        'Wait for us to contact you by post',
        'You applied by post to change something about the claim',
        'You might have to go to a hearing.',
        `We’ll contact you by post to tell you what to do next.`,
        `Your online account won’t be updated - any further updates will be by post.`
      ],
      defendantAssertions: [
        fullDefenceClaim().claim.claimants[0].name + ' applied by post to change something about the claim',
        `We’ll post you a copy of their application. This will explain what you need to do next.`,
        `Your online account won’t be updated - any further updates will be by post.`
      ]
    },
    {
      status: 'Full defence - defendant asked to proceed offline',
      claim: fullDefenceClaim(),
      claimOverride: {
        response: {
          ...baseResponseData,
          ...baseDefenceData,
          freeMediation: FreeMediationOption.YES
        },
        proceedOfflineReason: ProceedOfflineReason.APPLICATION_BY_DEFENDANT
      },
      claimantAssertions: [
        fullDefenceClaim().claim.defendants[0].name + ' applied by post to change something about the claim',
        'We’ll post you a copy of their application. This will explain what you need to do next.',
        'Your online account won’t be updated - any further updates will be by post.'
      ],
      defendantAssertions: [
        'You applied by post to change something about the claim',
        'You might have to go to a hearing.',
        'We’ll contact you by post to tell you what to do next.',
        'Your online account won’t be updated - any further updates will be by post.'
      ]
    }
  ]
}

const claimPagePath = Paths.claimantPage.evaluateUri({ externalId: fullDefenceClaim().externalId })
const defendantPagePath = Paths.defendantPage.evaluateUri({ externalId: fullDefenceClaim().externalId })

describe('Dashboard page', () => {
  attachDefaultHooks(app)

  describe('on GET', () => {
    checkAuthorizationGuards(app, 'get', claimPagePath)
    checkAuthorizationGuards(app, 'get', defendantPagePath)

    context('when user authorised', () => {
      context('Claim Status', () => {
        context('as a claimant', () => {
          beforeEach(() => {
            idamServiceMock.resolveRetrieveUserFor('1', 'citizen')
            claimStoreServiceMock.mockNextWorkingDay(MomentFactory.parse('2019-08-16'))
          })

          testData().forEach(data => {
            it(`should render claim status: ${data.status}`, async () => {
              claimStoreServiceMock.resolveRetrieveByExternalId(data.claim, data.claimOverride)

              await request(app)
                .get(claimPagePath)
                .set('Cookie', `${cookieName}=ABC`)
                .expect(res => expect(res).to.be.successful.withText(...data.claimantAssertions))
            })
          })
        })

        context('as a defendant', () => {
          beforeEach(() => {
            idamServiceMock.resolveRetrieveUserFor('123', 'citizen')
          })

          testData().forEach(data => {
            it(`should render dashboard: ${data.status}`, async () => {
              claimStoreServiceMock.resolveRetrieveByExternalId(data.claim, data.claimOverride)

              await request(app)
                .get(defendantPagePath)
                .set('Cookie', `${cookieName}=ABC`)
                .expect(res => expect(res).to.be.successful.withText(...data.defendantAssertions))
            })
          })
        })
      })
    })
  })
})
