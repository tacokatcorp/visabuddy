// Visa Buddy - Content Script
// Injected into every page.

function isExpiredVal(d) {
  return d ? new Date(d) < new Date() : false;
}

window.__vbFill = function(profile, action) {
  var filled = 0;

  function nativeSet(el, value) {
    if (!el || !value) return false;
    var proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype
      : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    var descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
    var setter = descriptor && descriptor.set;
    if (setter) setter.call(el, value);
    else el.value = value;
    ['input', 'change', 'blur'].forEach(function(e) {
      el.dispatchEvent(new Event(e, { bubbles: true }));
    });
    el.style.outline = '2px solid #0D9488';
    setTimeout(function() { el.style.outline = ''; }, 1500);
    filled++;
    return true;
  }

  function find() {
    var patterns = Array.prototype.slice.call(arguments);
    for (var i = 0; i < patterns.length; i++) {
      var p = patterns[i];
      if (!p) continue;
      var lp = p.toLowerCase();
      var el = document.querySelector('[name="' + p + '"]') ||
               document.querySelector('[name*="' + lp + '"]');
      if (el) return el;
      el = document.querySelector('[id*="' + lp + '"]');
      if (el) return el;
      el = document.querySelector('[placeholder*="' + lp + '" i]');
      if (el) return el;
      el = document.querySelector('[aria-label*="' + lp + '" i]');
      if (el) return el;
      var labels = document.querySelectorAll('label');
      for (var j = 0; j < labels.length; j++) {
        var label = labels[j];
        if (label.textContent.toLowerCase().indexOf(lp) !== -1) {
          var fid = label.getAttribute('for');
          var t = fid ? document.getElementById(fid)
            : label.querySelector('input,select,textarea');
          if (t) return t;
        }
      }
    }
    return null;
  }

  var fa = action;

  if (fa === 'fill-all' || fa === 'fill-address') {
    var addr = (profile.addresses || []).filter(function(x) { return !x.toDate; })[0]
               || (profile.addresses || [])[0];
    if (addr) {
      nativeSet(find('street', 'address', 'address1', 'streetAddress'), addr.street);
      nativeSet(find('city', 'municipality', 'town'), addr.city);
      nativeSet(find('province', 'state', 'region', 'prov'), addr.province);
      nativeSet(find('country', 'countryOfResidence'), addr.country);
      nativeSet(find('postal', 'postalCode', 'postcode', 'zip', 'zipCode'), addr.postal);
    }
  }

  if (fa === 'fill-all' || fa === 'fill-employment') {
    var job = (profile.employment || []).filter(function(x) { return !x.toDate; })[0]
              || (profile.employment || [])[0];
    if (job) {
      nativeSet(find('employer', 'company', 'companyName', 'organization'), job.employer);
      nativeSet(find('title', 'jobTitle', 'occupation', 'position', 'role'), job.title);
      nativeSet(find('employerCity', 'workCity', 'jobCity'), job.city);
      nativeSet(find('employerCountry', 'workCountry', 'jobCountry'), job.country);
    }
  }

  if (fa === 'fill-all' || fa === 'fill-passports') {
    var pp = (profile.passports || [])
      .filter(function(x) { return x.docType === 'passport' && !isExpiredVal(x.expiryDate); })[0]
      || (profile.passports || [])[0];
    if (pp) {
      nativeSet(find('passportNumber', 'passport', 'documentNumber', 'docNumber'), pp.number);
      nativeSet(find('passportCountry', 'issuingCountry', 'countryOfIssue'), pp.country);
      nativeSet(find('passportExpiry', 'expiryDate', 'expiry', 'passportExpiryDate'), pp.expiryDate);
      nativeSet(find('passportIssue', 'issueDate', 'dateOfIssue'), pp.issueDate);
      if (pp.holderName) nativeSet(find('holderName', 'passportName', 'nameAsOnPassport'), pp.holderName);
    }
  }

  if (fa === 'fill-all' || fa === 'fill-travel') {
    var trips = (profile.travel || []).slice().sort(function(a, b) {
      return new Date(b.entryDate) - new Date(a.entryDate);
    });
    var trip = trips[0];
    if (trip) {
      nativeSet(find('lastCountry', 'lastVisited', 'countryVisited', 'previousCountry'), trip.country);
      nativeSet(find('lastEntry', 'lastArrival', 'dateOfLastEntry'), trip.entryDate);
      nativeSet(find('lastDeparture', 'dateOfLastDeparture', 'lastExit'), trip.exitDate);
    }
  }

  if (fa === 'fill-all' || fa === 'fill-language') {
    var tests = (profile.language || []).slice().sort(function(a, b) {
      return new Date(b.testDate) - new Date(a.testDate);
    });
    var test = tests[0];
    if (test) {
      nativeSet(find('languageTest', 'testType', 'englishTest', 'languageExam'), test.testType);
      nativeSet(find('languageScore', 'testScore', 'overallScore', 'clbScore'), test.score);
      nativeSet(find('testDate', 'languageTestDate', 'examDate'), test.testDate);
    }
  }

  return filled;
};
