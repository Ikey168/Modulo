import {test,expect} from '@playwright/test';
test('keyboard opens properties, changes a choice and saves at mobile width',async({page})=>{
 await page.setViewportSize({width:360,height:800});await page.route('https://fonts.googleapis.com/**',route=>route.abort());await page.route('https://fonts.gstatic.com/**',route=>route.abort());
 await page.route('**/api/note-properties/**',route=>route.fulfill({json:route.request().url().endsWith('/definitions')?[{key:'status',title:'Status',type:'select',options:['Open','Closed'],revision:1}]:[{noteId:10,version:2,values:{status:'Open'}}]}));
 await page.goto('/tests/fixtures/properties.html');await page.keyboard.press('Tab');await page.keyboard.press('Enter');
 const choice=page.getByRole('combobox',{name:'Status',exact:true});await expect(choice).toBeVisible();await page.keyboard.press('Tab');await page.keyboard.press('Tab');await expect(choice).toBeFocused();await page.keyboard.press('ArrowDown');await page.keyboard.press('Tab');
 const save=page.getByRole('button',{name:'Save properties and Markdown'});await expect(save).toBeFocused();const request=page.waitForRequest('**/api/note-properties/document');await page.keyboard.press('Enter');expect((await request).postDataJSON().change.set.status).toBe('Closed');await expect(page.getByRole('status')).toContainText('saved');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
