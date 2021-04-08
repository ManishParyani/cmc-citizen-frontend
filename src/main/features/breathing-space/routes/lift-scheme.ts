import * as express from 'express'

import { Paths } from 'breathing-space/paths'
import { Paths as DashboardPaths } from 'dashboard/paths'
import { Form } from 'forms/form'
import { FormValidator } from 'forms/validation/formValidator'
import { ErrorHandling } from 'shared/errorHandling'
import { ClaimStoreClient } from 'claims/claimStoreClient'
import { DraftClaim } from 'drafts/models/draftClaim'
import { BreathingSpaceLiftDate } from '../models/bsLiftDate'

function renderView (form: Form<BreathingSpaceLiftDate>, res: express.Response, next: express.NextFunction) {
  res.render(Paths.bsLiftCheckAnswersPage.associatedView, {
    form: form
  })
}

/*  tslint:disable:no-default-export */
export default express.Router()
    .get(Paths.bsLiftCheckAnswersPage.uri, async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (res.app.locals.breathingSpaceLiftedbyInsolvencyTeamDate) {
        renderView(new Form(new BreathingSpaceLiftDate(res.app.locals.breathingSpaceLiftedbyInsolvencyTeamDate.toMoment().format('DD MMMM YYYY'))), res, next)
      } else {
        renderView(new Form(new BreathingSpaceLiftDate()), res, next)
      }
    })
    .post(
      Paths.bsLiftCheckAnswersPage.uri,
      FormValidator.requestHandler(BreathingSpaceLiftDate),
      ErrorHandling.apply(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
        let draft: DraftClaim = new DraftClaim()
        draft.breathingSpace.breathingSpaceLiftedFlag = 'Yes'
        draft.breathingSpace.breathingSpaceExternalId = res.app.locals.breathingSpaceExternalId
        draft.breathingSpace.breathingSpaceLiftedbyInsolvencyTeamDate = res.app.locals.breathingSpaceLiftedbyInsolvencyTeamDate
        try {
          await new ClaimStoreClient().saveBreatingSpace(draft, res.locals.user)
          res.redirect(DashboardPaths.claimantPage.uri.replace(':externalId', res.app.locals.breathingSpaceExternalId))
        } catch {
          res.redirect(DashboardPaths.claimantPage.uri.replace(':externalId', res.app.locals.breathingSpaceExternalId))
        }
      }))
