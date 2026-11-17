  const fs = require('fs');
  const p = 'src/app/landing/signup/page.js';
  let s = fs.readFileSync(p, 'utf8');

  // 1) Remove terms block (from "{/* Terms */}" through the closing </div> of that block)
  const tStart = s.indexOf('{/* Terms */}');
  if (tStart !== -1) {
    const tEnd = s.indexOf('{/* Submit */}', tStart);
    s = s.slice(0, tStart) + s.slice(tEnd);
  }

  // 2) Remove divider + Google + secure + sign-in link (from "{/* Divider */}" to the closing </form>)
  const dStart = s.indexOf('{/* Divider */}');
  if (dStart !== -1) {
    const fEnd = s.indexOf('</form>', dStart);
    s = s.slice(0, dStart) + '\n            </form>\n' + s.slice(fEnd + '</form>'.length);
  }

  fs.writeFileSync(p, s);
  console.log('terms removed:', !s.includes('renderFieldError("agree")'));
  console.log('google tail removed:', !s.includes('LazyGoogleLogin'));
