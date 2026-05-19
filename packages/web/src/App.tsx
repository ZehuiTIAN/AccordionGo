import { useState } from 'react';
import type { Level } from '@accordion/core';
import { LessonPlayer } from './components/LessonPlayer';
import { twinkleStar } from './content/twinkleStar';
import './App.css';

type Screen = 'home' | 'play';

export function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [activeLevel, setActiveLevel] = useState<Level | null>(null);

  const startLevel = (level: Level) => {
    setActiveLevel(level);
    setScreen('play');
  };

  if (screen === 'play' && activeLevel) {
    return (
      <LessonPlayer
        level={activeLevel}
        onBack={() => setScreen('home')}
      />
    );
  }

  return (
    <div className="home">
      <div className="hero">
        <div className="logo">🪗</div>
        <h1 className="appName">AccordionGo</h1>
        <p className="tagline">10 分钟学会一首歌，零基础也能演奏手风琴</p>
      </div>

      <div className="courseSection">
        <h2 className="sectionTitle">入门曲目</h2>
        <div className="courseCard">
          <div className="courseInfo">
            <span className="courseDifficulty">★☆☆☆☆</span>
            <h3 className="courseTitle">{twinkleStar.title}</h3>
            <p className="courseDesc">经典儿歌，右手单手入门，轻松上手</p>
          </div>
          <div className="levelButtons">
            {twinkleStar.levels.map(level => (
              <button
                key={level.id}
                className={`levelBtn ${level.mode}`}
                onClick={() => startLevel(level)}
              >
                {level.mode === 'demo' ? '▶ 演示' : '✋ 跟练'}
              </button>
            ))}
          </div>
        </div>

        <div className="comingSoon">
          <div className="comingSoonCard">🎵 生日快乐 <span>即将上线</span></div>
          <div className="comingSoonCard">🌸 茉莉花 <span>即将上线</span></div>
        </div>
      </div>

      <footer className="footer">MVP Demo · Phase 1</footer>
    </div>
  );
}
