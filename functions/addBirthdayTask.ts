import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { personName, birthday } = await req.json();
    
    if (!personName || !birthday) {
      return Response.json({ error: 'Missing personName or birthday' }, { status: 400 });
    }

    // Parse the birthday date (could be "MM/DD/YYYY" or "MM-DD-YYYY" or similar)
    // Append T00:00:00 so it's parsed as local time, not UTC (avoids off-by-one day bug)
    const birthDate = new Date(birthday.includes('T') ? birthday : birthday + 'T00:00:00');
    if (isNaN(birthDate.getTime())) {
      return Response.json({ error: 'Invalid birthday date' }, { status: 400 });
    }

    // Create task for this year's birthday
    const taskName = `${personName}'s Birthday 🎂`;

    // Get the current year to set the scheduled_date
    const currentYear = new Date().getFullYear();
    const birthdayMonth = birthDate.getMonth(); // 0-11
    const birthdayDay = birthDate.getDate();
    const thisYearBirthday = new Date(currentYear, birthdayMonth, birthdayDay);

    // If birthday already passed this year, use next year
    const now = new Date();
    if (thisYearBirthday < now) {
      thisYearBirthday.setFullYear(currentYear + 1);
    }

    // Format using local date parts to avoid UTC conversion shifting the date back
    const pad = (n: number) => String(n).padStart(2, '0');
    const scheduledDate = `${thisYearBirthday.getFullYear()}-${pad(thisYearBirthday.getMonth() + 1)}-${pad(thisYearBirthday.getDate())}`;

    // Create the birthday task with frequency as the day of week
    const dow = thisYearBirthday.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    
    await base44.entities.Task.create({
      name: taskName,
      category: 'personal',
      frequency: dow, // Repeat on this day of week
      scheduled_date: scheduledDate,
      is_active: true,
      reminder_enabled: true,
      reminder_time: '09:00',
      reminder_type: 'in_app',
    });

    return Response.json({ success: true, taskName, scheduledDate });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});