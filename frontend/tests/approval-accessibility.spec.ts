import {test,expect} from '@playwright/test';
for (const width of [360,1280]) test(`reviewer can decide by keyboard at ${width}px`,async ({page}) => {
  await page.setViewportSize({width,height:800});
  let resolved=false;let submissions=0;
  const approval=()=>({id:'request-1',revision:resolved?2:1,state:resolved?'APPROVED':'PENDING',runState:resolved?'SUCCEEDED':'WAITING',requester:'1',reviewer:'2',blueprintName:'Invoice review',expiresAt:'2099-01-01T00:00:00Z',createdAt:'2026-09-05T00:00:00Z',evidenceDigest:'a'.repeat(64),summary:{message:'Review this invoice',omissions:['Note contents']},canDecide:!resolved,decisions:[],events:[]});
  await page.route(/\/api\/approvals/,async route=>{
    if(route.request().method()==='POST'){submissions++;resolved=true;await route.fulfill({json:{state:'APPROVED'}});}
    else await route.fulfill({json:route.request().url().includes('request-1')?approval():[approval()]});
  });
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.goto('/tests/fixtures/approval.html', {waitUntil:'domcontentloaded'});
  await expect(page.getByRole('heading',{name:'Invoice review'})).toBeFocused();
  await expect(page.getByRole('button',{name:'Record decision'})).toBeDisabled();
  await page.getByRole('combobox',{name:'Decision',exact:true}).focus();
  await page.keyboard.press('Tab');await expect(page.getByRole('textbox')).toBeFocused();
  await page.keyboard.type('Reviewed evidence');await page.keyboard.press('Tab');
  await expect(page.getByRole('checkbox')).toBeFocused();await page.keyboard.press('Space');
  await page.keyboard.press('Tab');await expect(page.getByRole('button',{name:'Record decision'})).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status').filter({hasText:'Decision recorded'})).toBeVisible();
  await expect(page.getByText('SUCCEEDED',{exact:true})).toBeVisible();expect(submissions).toBe(1);
  await expect(page.getByRole('button',{name:'Record decision'})).toHaveCount(0);
});
