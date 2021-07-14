import { Fragment, useState, useCallback } from 'react'
import { css } from '../../glamor-jss';
// import * as css from 'glamor-jss';
import { Switch, TRANSITION_DURATION } from './Switch'
import { Banner } from './Banner'
import JssDarkIcon from '../assets/jss-dark.svg';
import JssLightIcon from '../assets/jss-light.svg';

const styles = {
  wrapper: css({
    width: '100vw',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    transition: `${TRANSITION_DURATION}ms`,
  }),
  underline: (backgroundColor: string, lineColor: string) =>
    css({
      display: 'inline-block',
      textDecoration: 'none',
      paddingBottom: `4px`,
      marginBottom: `-4px`,
      backgroundImage: `linear-gradient(${lineColor}, ${lineColor})`,
      backgroundRepeat: 'no-repeat',
      backgroundSize: '100% 1px',
      backgroundPosition: 'center bottom 26%',
      backgroundOrigin: 'padding-box',
      textShadow: `3px 0 ${backgroundColor},
      2px 0 ${backgroundColor},
      1px 0 ${backgroundColor},
      -1px 0 ${backgroundColor},
      -2px 0 ${backgroundColor},
      -3px 0 ${backgroundColor}`,
    }),

  imageWrapper: (color: string) =>
    css({
      position: 'relative',
      width: `200px`,
      height: `200px`,
      '& div': {
        position: 'absolute',
        transition: `${TRANSITION_DURATION}ms`,
      },
      ':before': {
        content: `'*'`,
        transition: `${TRANSITION_DURATION}ms`,
        position: 'absolute',
        right: '-15px',
        top: `75px`,
        color,
        fontSize: '42px',
        fontWeight: 'bold',
      },
    }),

  switch: css({
    position: 'absolute',
    right: 0,
    bottom: 0,
    margin: `50px`,
  }),
} as any;

export const App = () => {
  const [lightsOn, setLightsOn] = useState(true);
  const handleButtonClick = useCallback(() => setLightsOn(!lightsOn), [lightsOn]);
  const background = lightsOn ? '#fff' : '#25292f';
  const fontColor = lightsOn ? '#000' : '#f7df1f';
  return (
    <>
      <Banner
        fill={lightsOn ? '#25292f' : '#fff'}
        color={lightsOn ? '#fff' : '#25292f'}
      />
      <div id='github-link-double-wrapper' {...css(styles.wrapper, { background })}>
        <div id='github-link-wrapper' {...styles.imageWrapper(fontColor)}>
          <a id='github-link' href="http://localhost:3000" {...css({ width: '100%', height: '100%', display: 'block' })} >
            <div id='github-link-image-light-wrapper' {...css({ opacity: !lightsOn && 0 })}>
              <img src={JssLightIcon} width={200} alt="" />
            </div>
            <div id='github-link-image-dark-wrapper' {...css({ opacity: lightsOn && 0 })}>
              <img src={JssDarkIcon} width={200} alt="" />
            </div>
          </a>
        </div>
        <div id='flippy-glamor-style-wrapper' {...css({ fontSize: 21, transform: 'translateX(-8%)' })} >
          <span id='flippy-glamor-style-asterisk' {...css({ color: fontColor, transition: `${TRANSITION_DURATION}ms` })} >
            *
          </span>
          <a id='flippy-glamor-style-glamor-hyperlink' href="http://localhost:3000">
            <span
               id='flippy-glamor-style-with'
              {...css({
                display: 'inline-block',
                color: fontColor,
                transition: `
                  transform 1000ms cubic-bezier(0.25, -0.5, 0.75, 1.4),
                  color ${TRANSITION_DURATION}ms,
                  background ${TRANSITION_DURATION}ms,
                  text-shadow ${TRANSITION_DURATION}ms
                `,
                ':hover': { transform: 'rotateY(360deg)' },
              })}
            >
              with&nbsp;
              <span  id='flippy-glamor-style-glamor' {...css(styles.underline(background, '#cdbe4c'), { color: fontColor, transition: `${TRANSITION_DURATION}ms` })} >
                glamor
              </span>
              &nbsp;flavor
            </span>
          </a>
        </div>
      </div>
      <div  id='switch-positioning-wrapper' {...styles.switch}>
        <Switch onClick={handleButtonClick} on={lightsOn} />
      </div>
    </>
  );
};
