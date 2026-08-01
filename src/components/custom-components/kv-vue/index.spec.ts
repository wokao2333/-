import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import KvVue from './index.vue';

describe('KvVue', () => {
  it('keeps the unit column fixed when the value changes', async () => {
    const wrapper = mount(KvVue, {
      props: {
        label: 'Ua',
        labelWidth: 30,
        value: '1',
        valueWidth: 72,
        unit: 'V',
        unitWidth: 20,
        unitGap: 12
      }
    });
    const getGridStyle = () => wrapper.find('.kvGrid').attributes('style');

    expect(getGridStyle()).toContain('grid-template-columns: 30px 72px 32px');

    await wrapper.setProps({ value: '233.8' });

    expect(getGridStyle()).toContain('grid-template-columns: 30px 72px 32px');
  });

  it('uses scalable horizontal and vertical padding', () => {
    const wrapper = mount(KvVue, {
      props: {
        paddingX: 20,
        paddingY: 12
      }
    });

    expect(wrapper.find('.kvWrap').attributes('style')).toContain('padding: 12px 20px');
  });
});
