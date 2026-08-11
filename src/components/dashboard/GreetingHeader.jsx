import React from "react";
import { motion } from "framer-motion";


export default function GreetingHeader({ userName, overallStreak, tasksToday, completedToday }) {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const getMotivation = () => {
    if (completedToday === tasksToday && tasksToday > 0) return "You crushed it today!";
    if (completedToday > tasksToday / 2) return "You're on fire — keep going.";
    if (completedToday > 0) return "Great start — keep the momentum.";
    return "Let's make today count.";
  };

  const firstName = userName?.split(" ")[0] || "there";

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
      className="mb-10"
    >
      <h1 className="text-[32px] md:text-[36px] font-bold text-[hsl(220,13%,10%)] tracking-tight leading-tight">
        {getGreeting()}, {firstName}
      </h1>
      <p className="text-[hsl(220,9%,46%)] mt-1.5 text-[17px]">{getMotivation()}</p>


    </motion.div>
  );
}
