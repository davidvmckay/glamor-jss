import { css } from '../../src';

export const TRANSITION_DURATION = 250;

const styles = {
  socket: (on: boolean) =>
    css({
      background: on ? '#e8e8e8' : '#cdbe4c',
      width: `35px`,
      height: `55px`,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      boxShadow: `inset 0 0 7px rgba(0, 0, 0, 0.2), ${
        on ? '0 0 1px #25292f' : '0 0 6px 2px #545454'
      }`,
      borderRadius: `1px`,
      cursor: 'pointer',
    }),
  switch: (on: boolean) =>
    css({
      width: '35%',
      height: '50%',
      background: '#444',
      position: 'relative',
      ':after': {
        content: `''`,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        height: '50%',
        transition: `${TRANSITION_DURATION}ms`,
        background: '#dadada',
        transform: !on && 'translateY(100%)',
        border: '1px solid #888',
        boxShadow: `inset 0px ${on ? '-' : ''}5px 2px #a9a9a9`,
      },
    }),
}

export const Switch = (p: {
  on: boolean,
  onClick: () => void,
}) => (
  <div {...styles.socket(p.on)} onClick={p.onClick}>
    <div {...styles.switch(p.on)} />
  </div>
);
